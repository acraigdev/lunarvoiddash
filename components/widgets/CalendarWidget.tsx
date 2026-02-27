'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllCalendarEvents } from '@/lib/google';
import { useContactPhotos } from '@/hooks/useContactPhotos';
import { UserAvatar } from '../UserAvatar';
import { ZoneContainer } from '../ZoneContainer';
import { format, isToday, isTomorrow } from 'date-fns';
import { CalendarEvent } from '@/utils/GoogleEvents';
import { Nullable } from '@/lib/typeHelpers';

function formatEventTime(event: CalendarEvent): string {
  if (event.start.date) return 'All day';
  if (event.start.dateTime) {
    return format(new Date(event.start.dateTime), 'h:mm a');
  }
  return '';
}

function formatEventDate(event: CalendarEvent): string {
  const date = event.start.date
    ? new Date(event.start.date + 'T00:00:00') // parse as local midnight, not UTC
    : new Date(event.start.dateTime ?? 0);

  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';

  return format(date, 'iii, MMM d');
}

function groupByDate(events: Nullable<CalendarEvent[]>) {
  if (!events) return;
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const label = formatEventDate(event);
    const group = map.get(label) ?? [];
    group.push(event);
    map.set(label, group);
  }
  return map;
}

interface Props {
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  className?: string;
}

export function CalendarWidget({ isFocused = false, isActive = false, onActivate, className }: Props) {
  const { data: session } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data: events,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['calendar', 'all'],
    queryFn: () => fetchAllCalendarEvents(session!.accessToken),
    enabled: !!session?.accessToken,
  });

  const organizerEmails = useMemo(() => {
    if (!events) return [];
    const emails = new Set<string>();
    for (const event of events) {
      if (event.eventType === 'birthday') continue;
      // For shared calendars, organizer is the group address — use creator instead
      const isShared = event.calendarId?.includes('@group.calendar') ?? false;
      const person = isShared
        ? (event.creator ?? event.organizer)
        : (event.organizer ?? event.creator);
      if (person?.email) emails.add(person.email);
    }
    return Array.from(emails);
  }, [events]);

  const { getPhoto } = useContactPhotos(organizerEmails);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (isActive) {
      scrollRef.current.focus();
    } else {
      scrollRef.current.blur();
    }
  }, [isActive]);

  const grouped = groupByDate(events);

  return (
    <ZoneContainer ref={scrollRef} isFocused={isFocused} isActive={isActive} onClick={onActivate} className={className}>
      {!events ||
        (!events.length && (
          <p className="text-sm opacity-60">
            {isLoading
              ? 'Loading calendar…'
              : isError
                ? 'Could not load calendar.'
                : 'No upcoming events.'}
          </p>
        ))}
      {Array.from(grouped?.entries() ?? []).map(([dateLabel, dayEvents]) => (
        <div key={dateLabel} className="mb-3 last:mb-0">
          <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">
            {dateLabel}
          </p>
          <ul className="space-y-1.5">
            {dayEvents.map(event => {
              const isShared =
                event.calendarId?.includes('@group.calendar') ?? false;
              // For shared calendars, organizer is the group address — use creator instead
              const person = isShared
                ? (event.creator ?? event.organizer)
                : (event.organizer ?? event.creator);

              return (
                <li
                  key={`${event.calendarId}-${event.id}`}
                  className="flex gap-2 items-center"
                >
                  <span className="w-8 shrink-0 flex items-center justify-center text-xl">
                    {event.eventType === 'birthday' ? (
                      event.birthdayProperties?.type === 'anniversary' ? (
                        '🖤'
                      ) : (
                        '🎂'
                      )
                    ) : person ? (
                      <UserAvatar
                        email={person.email}
                        displayName={person.displayName}
                        photoUrl={getPhoto(person.email)}
                        borderColor={isShared ? event.calendarColor : null}
                        badge={
                          isShared && event.calendarName
                            ? {
                                initial: event.calendarName[0].toUpperCase(),
                                color: event.calendarColor ?? '#4285f4',
                              }
                            : null
                        }
                      />
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: event.calendarColor ?? '#4285f4',
                        }}
                      />
                    )}
                  </span>
                  <span className="text-xs opacity-60 w-14 shrink-0">
                    {formatEventTime(event)}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">
                    {event.summary}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </ZoneContainer>
  );
}
