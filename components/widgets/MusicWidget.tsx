'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchYouTubePlaylists } from '@/lib/google';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { ZoneContainer } from '../ZoneContainer';

interface Props {
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  pageId?: string;
  className?: string;
}

export function MusicWidget({
  isFocused,
  isActive,
  onActivate,
  pageId = 'default',
  className,
}: Props) {
  const { data: session } = useSession();
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const wasActive = useRef(false);

  const [cursorIndex, setCursorIndex] = useState(-1);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');

  // ── YouTube player ────────────────────────────────────────────────
  const {
    isReady,
    isPlaying,
    currentVideoTitle,
    loadPlaylist,
    nextVideo,
    previousVideo,
    togglePlay,
  } = useYouTubePlayer({ containerId: `yt-player-${pageId}` });

  // ── Fetch playlists ───────────────────────────────────────────────
  const {
    data: playlists = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['youtube', 'playlists'],
    queryFn: () => fetchYouTubePlaylists(session!.accessToken),
    enabled: !!session?.accessToken,
    staleTime: 30 * 60_000,
  });

  const totalCount = playlists.length;

  // ── Playlist selection handler ────────────────────────────────────
  const handleSelect = useCallback(
    (playlistId: string) => {
      setSelectedPlaylistId(playlistId);
      loadPlaylist(playlistId);
    },
    [loadPlaylist],
  );

  // ── Activation / deactivation ─────────────────────────────────────
  useEffect(() => {
    if (isActive && !wasActive.current) {
      setCursorIndex(totalCount > 0 ? 0 : -1);
    }
    if (!isActive && wasActive.current) {
      setCursorIndex(-1);
    }
    wasActive.current = isActive ?? false;
  }, [isActive, totalCount]);

  // ── Scroll active row into view ───────────────────────────────────
  useEffect(() => {
    if (cursorIndex >= 0) {
      rowRefs.current.get(cursorIndex)?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursorIndex]);

  // ── Keyboard / remote navigation ──────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursorIndex(i => Math.min(i + 1, totalCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursorIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setCursorIndex(i => {
          if (i >= 0 && i < totalCount) {
            handleSelect(playlists[i].id);
          }
          return i;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextVideo();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousVideo();
      } else if (e.key === ' ' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        togglePlay();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    totalCount,
    playlists,
    handleSelect,
    nextVideo,
    previousVideo,
    togglePlay,
  ]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div
      className={
        'flex gap-4 h-full' + (className ? ` ${className}` : '')
      }
    >
      {/* Left: playlist selector */}
      <ZoneContainer
        isFocused={isFocused}
        isActive={isActive}
        onClick={onActivate}
        className="w-64 shrink-0"
      >
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-60">
          Playlists
        </h2>

        {isLoading && (
          <p className="text-sm opacity-60">Loading playlists…</p>
        )}
        {isError && (
          <p className="text-sm opacity-60">Could not load playlists.</p>
        )}

        {!isLoading && !isError && playlists.length === 0 && (
          <p className="text-sm opacity-60">No playlists found.</p>
        )}

        {playlists.length > 0 && (
          <ul className="space-y-1">
            {playlists.map((pl, i) => {
              const isCursor = isActive && i === cursorIndex;
              const isSelected = pl.id === selectedPlaylistId;

              return (
                <li
                  key={pl.id}
                  ref={el => {
                    if (el) rowRefs.current.set(i, el);
                    else rowRefs.current.delete(i);
                  }}
                  className={
                    'flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors cursor-pointer' +
                    (isCursor ? ' bg-white/20' : '') +
                    (isSelected ? ' opacity-100' : ' opacity-50')
                  }
                  onClick={e => {
                    e.stopPropagation();
                    if (!isActive) onActivate?.();
                    handleSelect(pl.id);
                    setCursorIndex(i);
                  }}
                >
                  {pl.snippet.thumbnails?.default?.url && (
                    <img
                      src={pl.snippet.thumbnails.default.url}
                      alt=""
                      className="w-8 h-8 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {pl.snippet.title}
                    </p>
                    <p className="text-xs opacity-40">
                      {pl.contentDetails.itemCount} videos
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ZoneContainer>

      {/* Right: player + now playing */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <div id={`yt-player-${pageId}`} className="w-full h-full" />
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm opacity-60">Loading player…</p>
            </div>
          )}
        </div>

        {/* Controls + now playing */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-dark/50 backdrop-blur-xs">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={previousVideo}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white/70 hover:text-white"
              aria-label="Previous"
            >
              ⏮
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              onClick={nextVideo}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white/70 hover:text-white"
              aria-label="Next"
            >
              ⏭
            </button>
          </div>
          <span className="text-sm font-medium truncate opacity-60">
            {currentVideoTitle || 'No track selected'}
          </span>
        </div>
      </div>
    </div>
  );
}
