'use client';

import { useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllCalendarEvents } from '@/lib/google';
import type { CalendarEvent } from '@/lib/google';

function formatEventTime(event: CalendarEvent): string {
  if (event.start.date) return 'All day';
  if (event.start.dateTime) {
    return new Date(event.start.dateTime).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return '';
}

function formatEventDate(event: CalendarEvent): string {
  const date = event.start.date
    ? new Date(event.start.date + 'T00:00:00') // avoid UTC shift on date-only strings
    : new Date(event.start.dateTime!);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
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
  className?: string;
}

export function CalendarWidget({
  isFocused = false,
  isActive = false,
  className = '',
}: Props) {
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

  useEffect(() => {
    if (!scrollRef.current) return;
    if (isActive) {
      scrollRef.current.focus();
    } else {
      scrollRef.current.blur();
    }
  }, [isActive]);

  const widgetClass =
    'text-white rounded-xl px-5 py-4 bg-black/30 backdrop-blur-xs max-h-[70vh] overflow-y-auto transition-all' +
    (isActive
      ? ' outline outline-2 outline-white/60'
      : isFocused
        ? ' outline outline-2 outline-white/30'
        : '') +
    (className ? ` ${className}` : '');

  if (isLoading) {
    return (
      <div ref={scrollRef} tabIndex={0} className={widgetClass}>
        <p className="text-sm opacity-60">Loading calendar…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div ref={scrollRef} tabIndex={0} className={widgetClass}>
        <p className="text-sm opacity-60">Could not load calendar.</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div ref={scrollRef} tabIndex={0} className={widgetClass}>
        <p className="text-sm opacity-60">No upcoming events.</p>
      </div>
    );
  }

  const grouped = groupByDate(events);

  return (
    <div ref={scrollRef} tabIndex={0} className={widgetClass}>
      {Array.from(grouped.entries()).map(([dateLabel, dayEvents]) => (
        <div key={dateLabel} className="mb-3 last:mb-0">
          <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">
            {dateLabel}
          </p>
          <ul className="space-y-1">
            {dayEvents.map(event => (
              <li
                key={`${event.calendarId}-${event.id}`}
                className="flex gap-2 items-baseline"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 self-center"
                  style={{ backgroundColor: event.calendarColor ?? '#4285f4' }}
                />
                <span className="text-xs opacity-60 w-14 shrink-0 text-right">
                  {formatEventTime(event)}
                </span>
                <span className="text-sm font-medium truncate">
                  {event.summary}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
