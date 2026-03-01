'use client';

import { useZoneFocus } from '@/hooks/useZoneFocus';
import { RemoteNav } from '../RemoteNav';
import { CalendarWidget } from '../widgets/CalendarWidget';
import { TaskWidget } from '../widgets/TaskWidget';
import { WeatherWidget } from '../widgets/WeatherWidget';
import { PhotoWidget } from '../widgets/PhotoWidget';

export function HomeClient() {
  const { focusedIndex, isActive, activateZone } = useZoneFocus(3);

  return (
    <div className="h-full flex flex-col md:flex-row justify-center gap-3 overflow-hidden">
      <RemoteNav next="/music" prev="/task" />
      <div className="flex flex-col gap-3 min-h-0 md:flex-2 min-w-0">
        <div className="sm:flex gap-3 flex-1 min-h-0 overflow-hidden">
          <PhotoWidget
            isFocused={focusedIndex === 1}
            isActive={focusedIndex === 1 && isActive}
            onActivate={() => activateZone(1)}
            pageId="home"
            className="flex-1 min-w-0 max-w-fit"
          />
          <TaskWidget
            isFocused={focusedIndex === 0}
            isActive={focusedIndex === 0 && isActive}
            onActivate={() => activateZone(0)}
            pageId="home"
            className="sm:order-first max-w-72 min-h-0"
          />
        </div>
        <WeatherWidget className="shrink-0" />
      </div>
      <CalendarWidget
        isFocused={focusedIndex === 2}
        isActive={focusedIndex === 2 && isActive}
        onActivate={() => activateZone(2)}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
