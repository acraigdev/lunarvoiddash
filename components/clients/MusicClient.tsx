'use client';

import { useZoneFocus } from '@/hooks/useZoneFocus';
import { RemoteNav } from '../RemoteNav';
import { MusicWidget } from '../widgets/MusicWidget';

export function MusicClient() {
  const { focusedIndex, isActive, activateZone } = useZoneFocus(1);

  return (
    <>
      <RemoteNav next="/" prev="/tasks" />
      <MusicWidget
        isFocused={focusedIndex === 0}
        isActive={focusedIndex === 0 && isActive}
        onActivate={() => activateZone(0)}
        pageId="music"
        className="w-full h-full"
      />
    </>
  );
}
