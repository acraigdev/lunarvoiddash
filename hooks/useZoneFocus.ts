'use client';

import { useState, useEffect, useCallback } from 'react';
import { NAV_KEYS } from '@/lib/keys';

/**
 * Two-step focus model for FireStick remote + mouse navigation:
 *
 * Keyboard:
 *   Arrows → move focus between zones
 *   Enter  → activate the focused zone
 *   Escape → deactivate → unfocus
 *
 * Mouse:
 *   Click a zone → focus + activate it immediately
 *   Click outside → deactivate
 */
export function useZoneFocus(zoneCount: number) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isActive, setIsActive] = useState(false);

  /** Click a zone to immediately focus + activate it. */
  const activateZone = useCallback((index: number) => {
    setFocusedIndex(index);
    setIsActive(true);
  }, []);

  /** Deactivate without changing focus. */
  const deactivate = useCallback(() => {
    setIsActive(false);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!NAV_KEYS.has(e.key)) return;
      e.preventDefault();

      if (isActive) {
        if (e.key === 'Escape') setIsActive(false);
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        setFocusedIndex((i) => (i < zoneCount - 1 ? i + 1 : 0));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        setFocusedIndex((i) => (i > 0 ? i - 1 : zoneCount - 1));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        setIsActive(true);
      } else if (e.key === 'Escape' && focusedIndex >= 0) {
        setFocusedIndex(-1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, focusedIndex, zoneCount]);

  return { focusedIndex, isActive, activateZone, deactivate };
}
