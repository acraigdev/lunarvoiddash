// ─── Calendar list types ─────────────────────────────────────────────────────

export interface CalendarMeta {
  id: string;
  summary: string; // display name
  backgroundColor: string; // hex color Google assigns, e.g. "#0B8043"
  primary?: boolean;
  selected?: boolean; // whether the user has it checked in Google Calendar UI
}

export interface CalendarListResponse {
  items: CalendarMeta[];
}

// ─── Calendar types ──────────────────────────────────────────────────────────

export interface CalendarEventDateTime {
  dateTime?: string; // ISO 8601, present for timed events
  date?: string; // YYYY-MM-DD, present for all-day events
  timeZone?: string;
}

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
  self?: boolean;
  organizer?: boolean;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface CalendarEventPerson {
  email: string;
  displayName?: string;
  self?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: CalendarEventDateTime;
  end: CalendarEventDateTime;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink: string;
  eventType?:
    | 'default'
    | 'birthday'
    | 'focusTime'
    | 'outOfOffice'
    | 'workingLocation';
  birthdayProperties?: {
    type: 'birthday' | 'anniversary' | 'custom' | 'other';
    customTypeName?: string;
    contact?: string;
  };
  attendees?: CalendarEventAttendee[];
  creator?: CalendarEventPerson;
  organizer?: CalendarEventPerson;
  // Enriched client-side — not part of the Google API response
  calendarId?: string;
  calendarColor?: string;
  calendarName?: string;
  calendarPrimary?: boolean;
}

export interface CalendarEventList {
  items: CalendarEvent[];
  nextPageToken?: string;
}
