'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface UseYouTubePlayerOptions {
  containerId: string;
}

interface UseYouTubePlayerReturn {
  isReady: boolean;
  isPlaying: boolean;
  currentVideoTitle: string;
  /** Video IDs in the current (shuffled) play order. */
  playlistVideoIds: string[];
  /** Index of the currently playing video within playlistVideoIds. */
  currentIndex: number;
  /** Shuffle and load an array of video IDs. */
  loadPlaylist: (videoIds: string[]) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  togglePlay: () => void;
  /** Jump to a specific index in the playlist. */
  playVideoAt: (index: number) => void;
}

let apiLoading = false;
let apiReady = false;
const onReadyCallbacks: (() => void)[] = [];

function ensureAPI(cb: () => void) {
  if (apiReady && window.YT?.Player) {
    cb();
    return;
  }
  onReadyCallbacks.push(cb);
  if (apiLoading) return;
  apiLoading = true;

  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    apiReady = true;
    onReadyCallbacks.forEach(fn => fn());
    onReadyCallbacks.length = 0;
  };

  if (!document.getElementById('yt-iframe-api')) {
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function useYouTubePlayer({
  containerId,
}: UseYouTubePlayerOptions): UseYouTubePlayerReturn {
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  const [playlistVideoIds, setPlaylistVideoIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const pendingRef = useRef<string[] | null>(null);

  const loadPlaylist = useCallback((videoIds: string[]) => {
    const shuffled = shuffle(videoIds);
    if (!isReadyRef.current) {
      pendingRef.current = shuffled;
      return;
    }
    setPlaylistVideoIds(shuffled);
    playerRef.current?.loadPlaylist(shuffled);
  }, []);

  useEffect(() => {
    let destroyed = false;

    ensureAPI(() => {
      if (destroyed) return;
      const el = document.getElementById(containerId);
      if (!el || playerRef.current) return;

      playerRef.current = new window.YT.Player(containerId, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            isReadyRef.current = true;
            setIsReady(true);
            if (pendingRef.current) {
              const ids = pendingRef.current;
              pendingRef.current = null;
              setPlaylistVideoIds(ids);
              playerRef.current?.loadPlaylist(ids);
            }
          },
          onStateChange: (event: any) => {
            if (destroyed) return;
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
            const data = playerRef.current?.getVideoData?.();
            if (data?.title) setCurrentVideoTitle(data.title);
            const idx = playerRef.current?.getPlaylistIndex?.();
            if (typeof idx === 'number') setCurrentIndex(idx);
          },
        },
      });
    });

    return () => {
      destroyed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [containerId]);

  const skipVideo = useCallback((direction: 'next' | 'prev') => {
    if (!playerRef.current) return;
    const wasPaused =
      playerRef.current.getPlayerState() === window.YT.PlayerState.PAUSED;
    if (direction === 'next') playerRef.current.nextVideo();
    else playerRef.current.previousVideo();
    if (wasPaused) {
      setTimeout(() => playerRef.current?.pauseVideo(), 500);
    }
  }, []);

  const nextVideo = useCallback(() => skipVideo('next'), [skipVideo]);
  const previousVideo = useCallback(() => skipVideo('prev'), [skipVideo]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    const state = playerRef.current.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, []);

  const playVideoAt = useCallback((index: number) => {
    playerRef.current?.playVideoAt(index);
  }, []);

  return {
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
  };
}
