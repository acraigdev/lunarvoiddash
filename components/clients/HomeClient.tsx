'use client';

import { useZoneFocus } from '@/hooks/useZoneFocus';
// import { RemoteNav } from './RemoteNav';
import { CalendarWidget } from '../widgets/CalendarWidget';
import { TaskWidget } from '../widgets/TaskWidget';
import { WeatherWidget } from '../widgets/WeatherWidget';

export function HomeClient() {
  const { focusedIndex, isActive, activateZone } = useZoneFocus(2);

  return (
    <div className="h-full flex flex-row justify-center gap-8">
      {/* <RemoteNav next="/tasks" prev="/screen3" /> */}
      <div className="flex flex-col gap-4 min-h-0 grow justify-between">
        <TaskWidget
          isFocused={focusedIndex === 0}
          isActive={focusedIndex === 0 && isActive}
          onActivate={() => activateZone(0)}
          pageId="home"
          className="self-start min-h-0"
        />
        <WeatherWidget className="shrink-0" />
      </div>
      <CalendarWidget
        isFocused={focusedIndex === 1}
        isActive={focusedIndex === 1 && isActive}
        onActivate={() => activateZone(1)}
      />
    </div>
  );
}
