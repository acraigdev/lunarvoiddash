// Typed wrappers around the Google REST APIs.
// All requests use fetch() with a Bearer token from the Auth.js session.
// Get the token via: const session = await auth() (server) or useSession() (client).

import { MoonPhases } from '@/components/MoonPhase';
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

// ─── Weather types ──────────────────────────────────────────────────────────

export interface WeatherCondition {
  type: string;
  description: { text: string; languageCode: string };
  iconBaseUri: string;
}

export interface Temperature {
  degrees: number;
  unit: string;
}

export interface ForecastDay {
  interval: { startTime: string; endTime: string };
  displayDate: { year: number; month: number; day: number };
  daytimeForecast?: { weatherCondition: WeatherCondition };
  nighttimeForecast?: { weatherCondition: WeatherCondition };
  maxTemperature: Temperature;
  minTemperature: Temperature;
  moonEvents: {
    moonPhase: keyof typeof MoonPhases;
  };
}

interface ForecastDaysResponse {
  forecastDays: ForecastDay[];
}

// ─── Weather API (read-only) ────────────────────────────────────────────────

/** Fetch a multi-day forecast from the Google Weather API. */
export async function fetchDailyForecast(days = 5): Promise<ForecastDay[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const lat = process.env.NEXT_PUBLIC_LATITUDE;
  const lng = process.env.NEXT_PUBLIC_LONGITUDE;
  if (!apiKey || !lat || !lng) {
    throw new Error('Weather env vars not configured');
  }

  const params = new URLSearchParams({
    key: apiKey,
    'location.latitude': lat,
    'location.longitude': lng,
    days: String(days),
  });

  const res = await fetch(
    `https://weather.googleapis.com/v1/forecast/days:lookup?${params}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Weather API ${res.status}: ${text}`);
  }
  const data: ForecastDaysResponse = await res.json();
  return data.forecastDays ?? [];
}

// ─── Google Photos Picker types ─────────────────────────────────────────────

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    pollInterval: string; // e.g. "2s"
    timeoutIn: string; // e.g. "259200s"
  };
  expireTime: string; // RFC 3339
  mediaItemsSet?: boolean;
}

export interface PickerMediaItem {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
  };
}

interface PickerMediaItemsResponse {
  mediaItems?: PickerMediaItem[];
  nextPageToken?: string;
}

// ─── Google Photos Picker API ───────────────────────────────────────────────

/** Create a new Picker session. Returns the session with a pickerUri for the user to pick photos. */
export function createPickerSession(accessToken: string): Promise<PickerSession> {
  return googleMutate<PickerSession>(
    'https://photospicker.googleapis.com/v1/sessions',
    accessToken,
    'POST',
  );
}

/** Poll an existing Picker session to check if the user has finished picking. */
export function getPickerSession(
  accessToken: string,
  sessionId: string,
): Promise<PickerSession> {
  const id = encodeURIComponent(sessionId);
  return googleFetch<PickerSession>(
    `https://photospicker.googleapis.com/v1/sessions/${id}`,
    accessToken,
  );
}

/** Fetch all picked media items from a completed session. Paginates automatically. */
export async function fetchPickedMediaItems(
  accessToken: string,
  sessionId: string,
): Promise<PickerMediaItem[]> {
  const allItems: PickerMediaItem[] = [];
  let pageToken: string | undefined;
  const id = encodeURIComponent(sessionId);

  do {
    const params = new URLSearchParams({ sessionId: id, pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await googleFetch<PickerMediaItemsResponse>(
      `https://photospicker.googleapis.com/v1/mediaItems?${params}`,
      accessToken,
    );
    // Only keep photos, skip videos
    const photos = (data.mediaItems ?? []).filter(item => item.type === 'PHOTO');
    allItems.push(...photos);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

/**
 * Fetch a photo as a blob URL. The Picker API's baseUrl requires an Authorization
 * header, so we can't use it directly in an <img src>. Instead we fetch the image
 * via JS and create an object URL.
 */
export async function fetchPhotoBlob(
  accessToken: string,
  baseUrl: string,
  width = 1920,
  height = 1080,
): Promise<string> {
  const url = `${baseUrl}=w${width}-h${height}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Photo fetch ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
