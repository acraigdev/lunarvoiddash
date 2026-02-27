'use client';

import { useZoneFocus } from '@/hooks/useZoneFocus';
import { TaskWidget } from '../widgets/TaskWidget';
import { WeatherWidget } from '../widgets/WeatherWidget';

export function TasksClient() {
  const { focusedIndex, isActive } = useZoneFocus(1);

  return (
    <>
      <div className="absolute top-8 left-8 bottom-8 flex flex-col justify-between">
        <TaskWidget
          isFocused={focusedIndex === 0}
          isActive={focusedIndex === 0 && isActive}
          pageId="tasks"
        />
      </div>
      <div className="absolute bottom-8 right-8">
        <WeatherWidget />
      </div>
    </>
  );
}
