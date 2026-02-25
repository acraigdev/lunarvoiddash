'use client';

import { useState, useEffect } from 'react';

/**
 * Two-step focus model for FireStick remote navigation:
 *   1. Arrows → move focus between zones (subtle highlight)
 *   2. Enter  → activate the focused zone (strong highlight + inner interaction)
 *   3. Escape → deactivate → unfocus
 *
 * When a zone is active, arrows are NOT handled here — they pass through
 * to the active zone's own handlers (e.g. scroll, item navigation).
 */
export function useZoneFocus(zoneCount: number) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // When a zone is active, only Escape exits — all other keys
      // pass through to the zone's internal handlers.
      if (isActive) {
        if (e.key === 'Escape') {
          setIsActive(false);
          e.preventDefault();
        }
        return;
      }

      // Zone navigation (not active)
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedIndex((i) => (i < zoneCount - 1 ? i + 1 : 0));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedIndex((i) => (i > 0 ? i - 1 : zoneCount - 1));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        setIsActive(true);
      } else if (e.key === 'Escape' && focusedIndex >= 0) {
        e.preventDefault();
        setFocusedIndex(-1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, focusedIndex, zoneCount]);

  return { focusedIndex, isActive };
}