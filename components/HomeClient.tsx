'use client';

import { useZoneFocus } from '@/hooks/useZoneFocus';
// import { RemoteNav } from './RemoteNav';
import { CalendarWidget } from './CalendarWidget';
// import { TaskList } from './TaskList';

export function HomeClient() {
  const { focusedIndex, isActive } = useZoneFocus(1);

  return (
    <div className="flex flex-col-2 justify-between">
      {/* <RemoteNav next="/tasks" prev="/screen3" /> */}
      {/* <TaskList
        isFocused={focusedIndex === 0}
        isActive={focusedIndex === 0 && isActive}
      /> */}
      <CalendarWidget
        isFocused={focusedIndex === 0}
        isActive={focusedIndex === 0 && isActive}
        className=""
      />
    </div>
  );
}
