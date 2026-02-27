'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPickerSession,
  getPickerSession,
  fetchPickedMediaItems,
  fetchPhotoBlob,
  PickerMediaItem,
} from '@/lib/google';
import { ZoneContainer } from '../ZoneContainer';

interface Props {
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  pageId?: string;
  className?: string;
}

function getSessionStorageKey(pageId: string) {
  return `photos-picker-session-${pageId}`;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const EMPTY_ITEMS: PickerMediaItem[] = [];

export function PhotoWidget({
  isFocused,
  isActive,
  onActivate,
  pageId = 'default',
  className,
}: Props) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // ── Persisted session ID ──────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(getSessionStorageKey(pageId)) || '';
  });

  const [polling, setPolling] = useState(false);
  const [picking, setPicking] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch picked media items (only when we have a session) ────────
  const {
    data: mediaItems = EMPTY_ITEMS,
    isLoading,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['photos', 'pickerItems', sessionId],
    queryFn: () => fetchPickedMediaItems(session!.accessToken, sessionId),
    enabled: !!session?.accessToken && !!sessionId && !polling,
    staleTime: 30 * 60_000,
    refetchInterval: 45 * 60_000, // re-fetch to get fresh baseUrls
  });

  // ── Shuffled order ────────────────────────────────────────────────
  const shuffledItems = useMemo(
    () => shuffle(mediaItems),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaItems, dataUpdatedAt],
  );

  // ── Slideshow state ───────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displaySlot, setDisplaySlot] = useState<0 | 1>(0);
  const [slots, setSlots] = useState<[string, string]>(['', '']);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActive = useRef(false);

  // ── Load first photo when items change ────────────────────────────
  useEffect(() => {
    setCurrentIndex(0);
    setDisplaySlot(0);
    setSlots(['', '']);

    if (shuffledItems.length > 0 && session?.accessToken) {
      const item = shuffledItems[0];
      fetchPhotoBlob(session.accessToken, item.mediaFile.baseUrl)
        .then(blobUrl => setSlots([blobUrl, '']))
        .catch(() => {});
    }
  }, [shuffledItems, session?.accessToken]);

  // ── Advance to next photo ─────────────────────────────────────────
  const advance = useCallback(() => {
    if (shuffledItems.length <= 1 || !session?.accessToken) return;

    const nextIndex = (currentIndex + 1) % shuffledItems.length;
    const nextItem = shuffledItems[nextIndex];
    const nextSlot: 0 | 1 = displaySlot === 0 ? 1 : 0;

    fetchPhotoBlob(session.accessToken, nextItem.mediaFile.baseUrl)
      .then(blobUrl => {
        setSlots(prev => {
          // Revoke old blob URL in the slot we're about to overwrite
          if (prev[nextSlot]) URL.revokeObjectURL(prev[nextSlot]);
          const updated: [string, string] = [...prev];
          updated[nextSlot] = blobUrl;
          return updated;
        });
        requestAnimationFrame(() => {
          setDisplaySlot(nextSlot);
          setCurrentIndex(nextIndex);
        });
      })
      .catch(() => {
        // Skip this photo on error
        setCurrentIndex(nextIndex);
      });
  }, [shuffledItems, currentIndex, displaySlot, session?.accessToken]);

  // ── Auto-advance timer (30s) ──────────────────────────────────────
  useEffect(() => {
    if (shuffledItems.length <= 1) return;

    timerRef.current = setTimeout(advance, 30_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [advance, shuffledItems.length, currentIndex]);

  // ── Picker flow ───────────────────────────────────────────────────
  const openPicker = useCallback(async () => {
    if (!session?.accessToken || picking) return;
    setPicking(true);

    try {
      const pickerSession = await createPickerSession(session.accessToken);
      const newSessionId = pickerSession.id;

      // Open Google's picker UI in a popup
      const pickerUrl = pickerSession.pickerUri + '?autoclose';
      popupRef.current = window.open(
        pickerUrl,
        'google-photos-picker',
        'width=900,height=700',
      );

      // Start polling for completion
      setPolling(true);
      const pollIntervalMs = 2000;

      const pollFn = async () => {
        try {
          const updated = await getPickerSession(session.accessToken, newSessionId);
          if (updated.mediaItemsSet) {
            // User finished picking
            setSessionId(newSessionId);
            localStorage.setItem(getSessionStorageKey(pageId), newSessionId);
            setPolling(false);
            setPicking(false);
            // Invalidate any existing query so it refetches
            queryClient.invalidateQueries({
              queryKey: ['photos', 'pickerItems'],
            });
            return;
          }
        } catch {
          // Session may have expired or errored
        }

        // Check if popup was closed without completing
        if (popupRef.current?.closed) {
          // Keep polling a few more times in case the close was from autoclose
          pollTimerRef.current = setTimeout(async () => {
            try {
              const final = await getPickerSession(session.accessToken, newSessionId);
              if (final.mediaItemsSet) {
                setSessionId(newSessionId);
                localStorage.setItem(getSessionStorageKey(pageId), newSessionId);
                queryClient.invalidateQueries({
                  queryKey: ['photos', 'pickerItems'],
                });
              }
            } catch {
              // ignore
            }
            setPolling(false);
            setPicking(false);
          }, pollIntervalMs);
          return;
        }

        pollTimerRef.current = setTimeout(pollFn, pollIntervalMs);
      };

      pollTimerRef.current = setTimeout(pollFn, pollIntervalMs);
    } catch {
      setPicking(false);
      setPolling(false);
    }
  }, [session?.accessToken, picking, pageId, queryClient]);

  // Clean up poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ── Zone activation / deactivation ────────────────────────────────
  useEffect(() => {
    if (!isActive && wasActive.current) {
      // nothing special needed on deactivation for now
    }
    wasActive.current = isActive ?? false;
  }, [isActive]);

  // ── Keyboard navigation ───────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        openPicker();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, openPicker, advance]);

  // ── Render ────────────────────────────────────────────────────────

  const headerRow = (
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-bold uppercase tracking-widest px-1.5 py-0.5">
        Photos
      </span>
      <button
        className={
          'text-xs uppercase tracking-widest rounded px-2 py-1 cursor-pointer transition-colors' +
          (isActive
            ? ' bg-white/20 hover:bg-white/30'
            : ' bg-white/10 hover:bg-white/20')
        }
        onClick={e => {
          e.stopPropagation();
          if (!isActive) onActivate?.();
          openPicker();
        }}
      >
        {picking ? 'Picking…' : sessionId ? 'Change Photos' : 'Pick Photos'}
      </button>
    </div>
  );

  const slideshowContent = !sessionId ? (
    <p className="text-sm opacity-60">
      Press &quot;Pick Photos&quot; to select photos from Google Photos.
    </p>
  ) : isLoading ? (
    <p className="text-sm opacity-60">Loading photos…</p>
  ) : isError ? (
    <p className="text-sm opacity-60">Could not load photos. Try picking again.</p>
  ) : shuffledItems.length === 0 ? (
    <p className="text-sm opacity-60">No photos selected.</p>
  ) : (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
      <img
        src={slots[0]}
        alt=""
        className={
          'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000' +
          (displaySlot === 0 ? ' opacity-100' : ' opacity-0')
        }
      />
      <img
        src={slots[1]}
        alt=""
        className={
          'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000' +
          (displaySlot === 1 ? ' opacity-100' : ' opacity-0')
        }
      />
    </div>
  );

  return (
    <ZoneContainer
      isFocused={isFocused}
      isActive={isActive}
      className={className}
      onClick={onActivate}
    >
      {headerRow}
      {slideshowContent}
    </ZoneContainer>
  );
}
