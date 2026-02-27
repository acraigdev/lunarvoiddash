'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** Route for fast forward / menu button (next page). */
  next: string;
  /** Route for rewind (previous page). Optional. */
  prev?: string;
}

/**
 * Maps FireStick media keys to page navigation:
 *   Fast Forward / Menu → next
 *   Rewind             → prev
 * Arrow keys are intentionally NOT handled here —
 * they are owned by individual focusable zone components.
 */
export function RemoteNav({ next, prev }: Props) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'MediaFastForward' || e.key === 'ContextMenu' || e.key === 'm') {
        e.preventDefault();
        router.push(next);
      } else if (e.key === 'MediaRewind' && prev) {
        e.preventDefault();
        router.push(prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, next, prev]);

  return null;
}
