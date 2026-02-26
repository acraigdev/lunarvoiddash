// Typed wrappers around the Google REST APIs.
// All requests use fetch() with a Bearer token from the Auth.js session.
// Get the token via: const session = await auth() (server) or useSession() (client).

import {
  CalendarEvent,
  CalendarEventList,
  CalendarListResponse,
  CalendarMeta,
} from '@/utils/GoogleEvents';

// ─── Shared fetch helper ─────────────────────────────────────────────────────

async function googleFetch<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function googleMutate<T>(
  url: string,
  accessToken: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google API ${res.status}: ${text}`);
  }
  // DELETE returns 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Calendar list API ───────────────────────────────────────────────────────

/** Fetch every calendar the authenticated user has access to. */
export async function fetchCalendarList(
  accessToken: string,
): Promise<CalendarMeta[]> {
  const data = await googleFetch<CalendarListResponse>(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    accessToken,
  );
  return data.items ?? [];
}

// ─── Calendar API (read-only) ────────────────────────────────────────────────

/** Fetch events from the primary calendar for the next `days` days. */
export function fetchCalendarEvents(
  accessToken: string,
  days = 7,
): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  return googleFetch<CalendarEventList>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    accessToken,
  ).then(data => data.items ?? []);
}

/** Fetch events from a specific calendar by its ID. */
export function fetchCalendarEventsById(
  accessToken: string,
  calendarId: string,
  days = 7,
): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const id = encodeURIComponent(calendarId);
  return googleFetch<CalendarEventList>(
    `https://www.googleapis.com/calendar/v3/calendars/${id}/events?${params}`,
    accessToken,
  ).then(data => data.items ?? []);
}

/**
 * Fetch events from ALL of the user's calendars in parallel, merge them, and
 * sort by start time. Each event is enriched with the calendar's id and color
 * so the UI can show a colored indicator per calendar.
 */
export async function fetchAllCalendarEvents(
  accessToken: string,
  days = 7,
): Promise<CalendarEvent[]> {
  const allCalendars = await fetchCalendarList(accessToken);
  const calendars = allCalendars.filter(cal => cal.selected === true);

  const results = await Promise.allSettled(
    calendars.map(cal =>
      fetchCalendarEventsById(accessToken, cal.id, days).then(events =>
        events.map(e => ({
          ...e,
          calendarId: cal.id,
          calendarColor: cal.backgroundColor,
          calendarName: cal.summary,
          calendarPrimary: cal.primary ?? false,
        })),
      ),
    ),
  );

  const allEvents = results.flatMap(r =>
    r.status === 'fulfilled' ? r.value : [],
  );

  return allEvents.sort((a, b) => {
    const aTime = a.start.dateTime ?? a.start.date ?? '';
    const bTime = b.start.dateTime ?? b.start.date ?? '';
    return aTime.localeCompare(bTime);
  });
}

// ─── People API types ────────────────────────────────────────────────────

export interface PersonPhoto {
  url: string;
  metadata?: { primary?: boolean };
}

export interface PersonEmailAddress {
  value: string;
  metadata?: { primary?: boolean };
}

export interface Person {
  resourceName: string;
  photos?: PersonPhoto[];
  emailAddresses?: PersonEmailAddress[];
}

interface SearchContactsResponse {
  results?: Array<{ person: Person }>;
}

// ─── People API (read-only) ─────────────────────────────────────────────

/**
 * Search for a contact's photo by email. Checks saved contacts and
 * "other contacts" (auto-saved from email interactions) in parallel.
 * Returns the photo URL or undefined if not found.
 */
export async function searchContactPhoto(
  accessToken: string,
  email: string,
): Promise<string | undefined> {
  const params = new URLSearchParams({
    query: email,
    readMask: 'photos,emailAddresses',
  });

  const [contacts, others] = await Promise.allSettled([
    googleFetch<SearchContactsResponse>(
      `https://people.googleapis.com/v1/people:searchContacts?${params}`,
      accessToken,
    ),
    googleFetch<SearchContactsResponse>(
      `https://people.googleapis.com/v1/otherContacts:search?${params}`,
      accessToken,
    ),
  ]);

  const needle = email.toLowerCase();

  for (const result of [contacts, others]) {
    if (result.status !== 'fulfilled') continue;
    for (const match of result.value.results ?? []) {
      const hasEmail = match.person.emailAddresses?.some(
        e => e.value?.toLowerCase() === needle,
      );
      if (hasEmail) {
        return (
          match.person.photos?.find(p => p.metadata?.primary)?.url ??
          match.person.photos?.[0]?.url
        );
      }
    }
  }

  return undefined;
}

// ─── Tasks types ─────────────────────────────────────────────────────────────

export interface TaskList {
  id: string;
  title: string;
  updated: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string; // RFC 3339
  completed?: string; // RFC 3339
  parent?: string; // parent task id (for subtasks)
}

interface TaskListsResponse {
  items: TaskList[];
}

interface TasksResponse {
  items: Task[];
}

// ─── Tasks API — Read ────────────────────────────────────────────────────────

/** Fetch all task lists for the authenticated user. */
export function fetchTaskLists(accessToken: string): Promise<TaskList[]> {
  return googleFetch<TaskListsResponse>(
    'https://www.googleapis.com/tasks/v1/users/@me/lists',
    accessToken,
  ).then(data => data.items ?? []);
}

/** Fetch incomplete tasks from a specific task list. */
export function fetchTasks(
  accessToken: string,
  taskListId: string,
): Promise<Task[]> {
  const params = new URLSearchParams({
    showCompleted: 'false',
    maxResults: '100',
  });
  const id = encodeURIComponent(taskListId);
  return googleFetch<TasksResponse>(
    `https://www.googleapis.com/tasks/v1/lists/${id}/tasks?${params}`,
    accessToken,
  ).then(data => data.items ?? []);
}

/** Fetch tasks from the default (@default) task list. */
export function fetchDefaultTasks(accessToken: string): Promise<Task[]> {
  return fetchTasks(accessToken, '@default');
}

// ─── Tasks API — Write ───────────────────────────────────────────────────────

/** Create a new task in the given task list. */
export function createTask(
  accessToken: string,
  taskListId: string,
  task: Pick<Task, 'title'> & Partial<Omit<Task, 'id' | 'title'>>,
): Promise<Task> {
  const id = encodeURIComponent(taskListId);
  return googleMutate<Task>(
    `https://www.googleapis.com/tasks/v1/lists/${id}/tasks`,
    accessToken,
    'POST',
    task,
  );
}

/** Update fields on an existing task (partial update). */
export function updateTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  patch: Partial<Omit<Task, 'id'>>,
): Promise<Task> {
  const lid = encodeURIComponent(taskListId);
  const tid = encodeURIComponent(taskId);
  return googleMutate<Task>(
    `https://www.googleapis.com/tasks/v1/lists/${lid}/tasks/${tid}`,
    accessToken,
    'PATCH',
    patch,
  );
}

/** Mark a task as completed. */
export function completeTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
): Promise<Task> {
  return updateTask(accessToken, taskListId, taskId, {
    status: 'completed',
    completed: new Date().toISOString(),
  });
}

/** Delete a task permanently. */
export function deleteTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
): Promise<void> {
  const lid = encodeURIComponent(taskListId);
  const tid = encodeURIComponent(taskId);
  return googleMutate<void>(
    `https://www.googleapis.com/tasks/v1/lists/${lid}/tasks/${tid}`,
    accessToken,
    'DELETE',
  );
}
