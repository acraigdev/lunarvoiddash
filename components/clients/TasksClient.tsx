'use client';

import { useState } from 'react';
import { useZoneFocus } from '@/hooks/useZoneFocus';
import { RemoteNav } from '../RemoteNav';
import { TaskWidget } from '../widgets/TaskWidget';
import { ReaderWidget } from '../widgets/ReaderWidget';
import { PhotoWidget } from '../widgets/PhotoWidget';
import { Nullable } from '@/lib/typeHelpers';

export function TasksClient() {
  const { focusedIndex, isActive, activateZone } = useZoneFocus(2);
  const [active, setActive] =
    useState<Nullable<{ url?: Nullable<string>; title?: string }>>(null);
  const [showTemps, setShowTemps] = useState(false);

  return (
    <div className="h-full flex gap-3 overflow-hidden p-6 align-middle">
      <RemoteNav next="/" prev="/music" />

      {/* Cooking temps button */}
      <button
        onClick={() => setShowTemps(true)}
        className="absolute top-4 right-4 z-20 p-2 rounded-lg hover:brightness-125 transition-all"
        style={{ backgroundColor: '#111628' }}
        title="Meat cooking temperatures"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          width="44"
          height="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        >
          {/* Thermometer outer tube */}
          <path d="M11 28V10a5 5 0 0 1 10 0v18" />
          {/* Bulb outer */}
          <circle cx="16" cy="34" r="6" />
          {/* Bulb fill */}
          <circle cx="16" cy="34" r="3" fill="currentColor" stroke="none" />
          {/* Mercury column */}
          <line x1="16" y1="31" x2="16" y2="16" strokeWidth="3" />
          {/* Tick marks */}
          <line x1="21" y1="14" x2="24" y2="14" strokeWidth="1.5" />
          <line x1="21" y1="18" x2="23" y2="18" strokeWidth="1.5" />
          <line x1="21" y1="22" x2="24" y2="22" strokeWidth="1.5" />
          <line x1="21" y1="26" x2="23" y2="26" strokeWidth="1.5" />
          {/* Flame outer */}
          <path d="M27 34c0-8 6-18 6-18s6 10 6 18c0 4-3 6-6 6s-6-2-6-6z" />
          {/* Flame inner */}
          <path d="M30.5 35c0-4 2.5-8 2.5-8s2.5 4 2.5 8a2.5 2.5 0 0 1-5 0z" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {/* Cooking temps modal */}
      {showTemps && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(17, 22, 40, 0.92)' }}
          onClick={() => setShowTemps(false)}
        >
          <img
            src="/cooking_temps.png"
            alt="Meat cooking temperatures"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      <TaskWidget
        isFocused={focusedIndex === 0}
        isActive={focusedIndex === 0 && isActive}
        onActivate={() => activateZone(0)}
        onSelectLink={(url, title) => {
          setActive({ url, title });
        }}
        pageId="tasks"
        className="w-80 shrink-0 min-h-0"
      />

      {active?.url ? (
        <ReaderWidget
          url={active?.url}
          fallbackTitle={active?.title ?? null}
          isFocused={focusedIndex === 1}
          isActive={focusedIndex === 1 && isActive}
          onActivate={() => activateZone(1)}
          className="flex-1 min-h-0 min-w-0"
        />
      ) : (
        <PhotoWidget
          isFocused={focusedIndex === 1}
          isActive={focusedIndex === 1 && isActive}
          onActivate={() => activateZone(1)}
          pageId="tasks"
          className="flex-1 min-w-0 max-w-fit"
        />
      )}
    </div>
  );
}
