'use client';

import { useZoneFocus } from '@/hooks/useZoneFocus';
// import { RemoteNav } from './RemoteNav';
import { CalendarWidget } from '../widgets/CalendarWidget';
import { TaskWidget } from '../widgets/TaskWidget';
import { WeatherWidget } from '../widgets/WeatherWidget';
import { PhotoWidget } from '../widgets/PhotoWidget';

export function HomeClient() {
  const { focusedIndex, isActive, activateZone } = useZoneFocus(3);

  return (
    <div className="h-full flex flex-row justify-center gap-8">
      {/* <RemoteNav next="/tasks" prev="/screen3" /> */}
      <div className="flex flex-col gap-4 min-h-0 grow justify-between">
        <div className="flex gap-3">
          <TaskWidget
            isFocused={focusedIndex === 0}
            isActive={focusedIndex === 0 && isActive}
            onActivate={() => activateZone(0)}
            pageId="home"
            className="self-start min-h-0"
          />
          <PhotoWidget
            isFocused={focusedIndex === 1}
            isActive={focusedIndex === 1 && isActive}
            onActivate={() => activateZone(1)}
            pageId="home"
          />
        </div>
        <WeatherWidget className="shrink-0" />
      </div>
      <CalendarWidget
        isFocused={focusedIndex === 2}
        isActive={focusedIndex === 2 && isActive}
        onActivate={() => activateZone(2)}
      />
    </div>
  );
}
