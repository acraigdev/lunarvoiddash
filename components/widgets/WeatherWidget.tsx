'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchDailyForecast, ForecastDay } from '@/lib/google';
import { ZoneContainer } from '../ZoneContainer';
import { format } from 'date-fns';
import { MoonPhase } from '../MoonPhase';

function dayLabel(day: ForecastDay, index: number): string {
  if (index === 0) return 'Today';
  const d = new Date(
    day.displayDate.year,
    day.displayDate.month - 1,
    day.displayDate.day,
  );
  return format(d, 'EEE');
}

function weatherIcon(day: ForecastDay): string {
  const uri = day.daytimeForecast?.weatherCondition.iconBaseUri;
  if (!uri) return '';
  // Google returns a base URI; append size suffix for the actual image
  return `${uri}.png`;
}

export function WeatherWidget({ className }: { className?: string }) {
  const {
    data: days = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['weather', 'daily'],
    queryFn: () => fetchDailyForecast(5),
    staleTime: 30 * 60_000, // refresh every 30 min
  });

  if (isLoading) {
    return (
      <ZoneContainer>
        <p className="text-sm opacity-60">Loading weather…</p>
      </ZoneContainer>
    );
  }

  if (isError || days.length === 0) {
    return (
      <ZoneContainer>
        <p className="text-sm opacity-60">Could not load weather.</p>
      </ZoneContainer>
    );
  }

  const today = days[0];

  return (
    <ZoneContainer className={className}>
      <div className="flex justify-between">
        <div className="flex items-center gap-3 mb-3">
          {weatherIcon(today) && (
            <img src={weatherIcon(today)} alt="" className="w-10 h-10" />
          )}
          <p className="text-2xl font-bold leading-none">
            {Math.round(today.maxTemperature.degrees)}°
            <p className="text-xs opacity-60">
              {today.daytimeForecast?.weatherCondition.description.text}
            </p>
          </p>
        </div>
        <h3 className="flex items-center gap-4">
          {format(new Date(), 'iiii, LLL Do')}{' '}
          <MoonPhase phase={today.moonEvents.moonPhase} />
        </h3>
      </div>

      {/* 5-day row */}
      <div className="flex gap-3 items-start align-middle">
        {days.map((day, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 flex-1 min-w-0"
          >
            <span className="text-xs font-bold uppercase tracking-widest opacity-60">
              {dayLabel(day, i)}
            </span>
            {weatherIcon(day) && (
              <img
                src={weatherIcon(day)}
                alt=""
                className="w-8 h-8 saturate-[.6]"
              />
            )}
            <span className="text-xs font-medium flex gap-1">
              {Math.round(day.maxTemperature.degrees)}° |
              <span className="opacity-40">
                {Math.round(day.minTemperature.degrees)}°
              </span>
            </span>
          </div>
        ))}
      </div>
    </ZoneContainer>
  );
}
