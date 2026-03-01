'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchYouTubePlaylists, fetchPlaylistItems } from '@/lib/google';
import { NAV_KEYS } from '@/lib/keys';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { ZoneContainer } from '../ZoneContainer';
import { Dropdown, DropdownHandle } from '../Dropdown';

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
  const ddRef = useRef<DropdownHandle>(null);

  const [cursorIndex, setCursorIndex] = useState(-1);
  const [selectedId, setSelectedId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const cursorIndexRef = useRef(cursorIndex);
  cursorIndexRef.current = cursorIndex;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`music-selected-playlist-${pageId}`);
      if (saved) setSelectedId(JSON.parse(saved).id);
    } catch { /* ignore */ }
  }, [pageId]);

  const {
    isReady,
    isPlaying,
    currentVideoTitle,
    playlistVideoIds,
    currentIndex,
    loadPlaylist,
    nextVideo,
    previousVideo,
    togglePlay,
    playVideoAt,
  } = useYouTubePlayer({ containerId: `yt-player-${pageId}` });

  const { data: playlists = [] } = useQuery({
    queryKey: ['youtube', 'playlists'],
    queryFn: () => fetchYouTubePlaylists(session!.accessToken),
    enabled: !!session?.accessToken,
    staleTime: 30 * 60_000,
  });

  const { data: playlistItems = [] } = useQuery({
    queryKey: ['youtube', 'playlistItems', selectedId],
    queryFn: () => fetchPlaylistItems(session!.accessToken, selectedId),
    enabled: !!session?.accessToken && !!selectedId,
    staleTime: 30 * 60_000,
  });

  const tracks = useMemo(() => {
    if (playlistVideoIds.length === 0) {
      return playlistItems.map(item => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      }));
    }
    const titleMap = new Map(
      playlistItems.map(item => [
        item.snippet.resourceId.videoId,
        item.snippet.title,
      ]),
    );
    return playlistVideoIds.map(id => ({
      videoId: id,
      title: titleMap.get(id) || id,
    }));
  }, [playlistVideoIds, playlistItems]);

  // Load the player when playlist items arrive (initial or after selection change)
  const loadedPlaylistRef = useRef('');
  useEffect(() => {
    if (
      !isReady ||
      !selectedId ||
      playlistItems.length === 0 ||
      selectedId === loadedPlaylistRef.current
    )
      return;
    loadedPlaylistRef.current = selectedId;
    const videoIds = playlistItems.map(
      (item: any) => item.snippet.resourceId.videoId,
    );
    loadPlaylist(videoIds);
  }, [isReady, selectedId, playlistItems, loadPlaylist]);

  const dropdownItems = useMemo(
    () => playlists.map((pl: any) => ({ id: pl.id, label: pl.snippet.title })),
    [playlists],
  );

  // ── Row layout: [header] [playlist menu items...] [track items...] ─
  const headerCount = 1;
  const listCount = menuOpen ? dropdownItems.length : 0;
  const totalCount = headerCount + listCount + tracks.length;

  // ── Activation / deactivation ─────────────────────────────────────
  useEffect(() => {
    if (isActive && !wasActive.current) {
      setCursorIndex(totalCount > 0 ? 0 : -1);
    }
    if (!isActive && wasActive.current) {
      setCursorIndex(-1);
      ddRef.current?.closeMenu();
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
      if (!NAV_KEYS.has(e.key)) return;
      e.preventDefault();

      if (e.key === 'ArrowDown') {
        setCursorIndex(i => Math.min(i + 1, totalCount - 1));
      } else if (e.key === 'ArrowUp') {
        setCursorIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Escape' && menuOpen) {
        ddRef.current?.closeMenu();
        setCursorIndex(0);
      } else if (e.key === 'Enter') {
        const i = cursorIndexRef.current;
        if (i === 0) {
          ddRef.current?.toggleMenu();
        } else if (
          menuOpen &&
          i >= headerCount &&
          i < headerCount + listCount
        ) {
          ddRef.current?.selectAtIndex(i - headerCount);
          setCursorIndex(0);
        } else {
          const trackIndex = i - headerCount - listCount;
          if (trackIndex >= 0 && trackIndex < tracks.length) {
            if (playlistVideoIds.length > 0) {
              playVideoAt(trackIndex);
            }
          }
        }
      } else if (e.key === 'ArrowRight') {
        nextVideo();
      } else if (e.key === 'ArrowLeft') {
        previousVideo();
      } else if (e.key === ' ' || e.key === 'MediaPlayPause') {
        togglePlay();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    totalCount,
    headerCount,
    listCount,
    menuOpen,
    tracks,
    playlistVideoIds,
    playVideoAt,
    nextVideo,
    previousVideo,
    togglePlay,
  ]);

  return (
    <div className={'flex gap-4 h-full' + (className ? ` ${className}` : '')}>
      {/* Left: playlist dropdown + track list */}
      <ZoneContainer
        isFocused={isFocused}
        isActive={isActive}
        onClick={onActivate}
        className="w-64 shrink-0"
      >
        <Dropdown
          ref={ddRef}
          storageKey={`music-selected-playlist-${pageId}`}
          defaultLabel="Playlists"
          items={dropdownItems}
          isActive={isActive}
          cursorIndex={cursorIndex}
          rowRefs={rowRefs}
          onSelect={id => setSelectedId(id)}
          onMenuChange={setMenuOpen}
        />

        {tracks.length === 0 && selectedId && (
          <p className="text-sm opacity-60">Loading tracks…</p>
        )}
        {tracks.length === 0 && !selectedId && (
          <p className="text-sm opacity-60">Select a playlist.</p>
        )}
        {tracks.length > 0 && (
          <ul className="space-y-1">
            {tracks.map((track, i) => {
              const rowIndex = headerCount + listCount + i;
              const isCursor = isActive && rowIndex === cursorIndex;
              const isCurrent =
                playlistVideoIds.length > 0 && i === currentIndex;

              return (
                <li
                  key={`${track.videoId}-${i}`}
                  ref={el => {
                    if (el) rowRefs.current.set(rowIndex, el);
                    else rowRefs.current.delete(rowIndex);
                  }}
                  className={
                    'flex items-center gap-2 rounded-lg px-2 py-1 transition-colors cursor-pointer' +
                    (isCursor ? ' bg-white/20' : '') +
                    (isCurrent
                      ? ' opacity-100'
                      : i < currentIndex
                        ? ' opacity-30'
                        : ' opacity-50')
                  }
                  onClick={e => {
                    e.stopPropagation();
                    if (!isActive) onActivate?.();
                    if (playlistVideoIds.length > 0) playVideoAt(i);
                    setCursorIndex(rowIndex);
                  }}
                >
                  <span className="text-xs opacity-40 w-4 text-right shrink-0">
                    {isCurrent ? '▶' : i + 1}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {track.title}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ZoneContainer>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <div id={`yt-player-${pageId}`} className="w-full h-full" />
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm opacity-60">Loading player…</p>
            </div>
          )}
        </div>

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
