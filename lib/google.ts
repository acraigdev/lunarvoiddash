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
    unitsSystem: 'IMPERIAL',
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

// ─── Google Drive types ─────────────────────────────────────────────────────

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
}

interface DriveFileListResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

// ─── Google Drive API (read-only) ───────────────────────────────────────────

/** Fetch all folders from the user's Drive. */
export async function fetchDriveFolders(
  accessToken: string,
): Promise<DriveFolder[]> {
  const allFolders: DriveFolder[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'nextPageToken,files(id,name)',
      pageSize: '100',
      orderBy: 'name',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await googleFetch<DriveFileListResponse & { files?: DriveFolder[] }>(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      accessToken,
    );
    allFolders.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFolders;
}

/** Fetch image files from a specific Drive folder. */
export async function fetchDriveFolderImages(
  accessToken: string,
  folderId: string,
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;
  const id = folderId.replace(/'/g, "\\'");

  do {
    const params = new URLSearchParams({
      q: `'${id}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink)',
      pageSize: '100',
      orderBy: 'name',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await googleFetch<DriveFileListResponse>(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      accessToken,
    );
    allFiles.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Fetch a Drive image as a blob URL. Drive file content requires an Authorization
 * header, so we can't use it directly in an <img src>.
 */
export async function fetchDriveImageBlob(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Drive image fetch ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── YouTube types ──────────────────────────────────────────────────────────

export interface YouTubePlaylist {
  id: string;
  snippet: {
    title: string;
    thumbnails: {
      default?: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      high?: { url: string; width: number; height: number };
    };
  };
  contentDetails: {
    itemCount: number;
  };
}

interface YouTubePlaylistListResponse {
  items?: YouTubePlaylist[];
  nextPageToken?: string;
}

export interface YouTubePlaylistItem {
  id: string;
  snippet: {
    title: string;
    resourceId: { videoId: string };
    thumbnails: {
      default?: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
    };
  };
}

interface YouTubePlaylistItemListResponse {
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
}

// ─── YouTube API (read-only) ────────────────────────────────────────────────

/** Fetch all playlists owned by the authenticated user. */
export async function fetchYouTubePlaylists(
  accessToken: string,
): Promise<YouTubePlaylist[]> {
  const allPlaylists: YouTubePlaylist[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await googleFetch<YouTubePlaylistListResponse>(
      `https://www.googleapis.com/youtube/v3/playlists?${params}`,
      accessToken,
    );
    allPlaylists.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allPlaylists;
}

/** Fetch all items (videos) in a playlist. */
export async function fetchPlaylistItems(
  accessToken: string,
  playlistId: string,
): Promise<YouTubePlaylistItem[]> {
  const allItems: YouTubePlaylistItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId,
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await googleFetch<YouTubePlaylistItemListResponse>(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      accessToken,
    );
    allItems.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}
