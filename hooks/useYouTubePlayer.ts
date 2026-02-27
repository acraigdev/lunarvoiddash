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
  loadPlaylist: (playlistId: string) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  togglePlay: () => void;
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

export function useYouTubePlayer({
  containerId,
}: UseYouTubePlayerOptions): UseYouTubePlayerReturn {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  const pendingPlaylistRef = useRef<string | null>(null);

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
            setIsReady(true);
            // If a playlist was requested before ready, load it now
            if (pendingPlaylistRef.current) {
              const id = pendingPlaylistRef.current;
              pendingPlaylistRef.current = null;
              playerRef.current?.loadPlaylist({
                list: id,
                listType: 'playlist',
              });
              setTimeout(() => {
                playerRef.current?.setShuffle(true);
                playerRef.current?.playVideo();
              }, 1000);
            }
          },
          onStateChange: (event: any) => {
            if (destroyed) return;
            const YT = window.YT;
            setIsPlaying(event.data === YT.PlayerState.PLAYING);
            const data = playerRef.current?.getVideoData?.();
            if (data?.title) setCurrentVideoTitle(data.title);
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

  const loadPlaylist = useCallback((playlistId: string) => {
    if (!playerRef.current || !isReady) {
      pendingPlaylistRef.current = playlistId;
      return;
    }
    playerRef.current.loadPlaylist({
      list: playlistId,
      listType: 'playlist',
    });
    setTimeout(() => {
      playerRef.current?.setShuffle(true);
      playerRef.current?.playVideo();
    }, 1000);
  }, [isReady]);

  const nextVideo = useCallback(() => {
    if (!playerRef.current) return;
    const wasPaused =
      playerRef.current.getPlayerState() === window.YT.PlayerState.PAUSED;
    playerRef.current.nextVideo();
    if (wasPaused) {
      // YT auto-plays on next/prev — re-pause after the state settles
      setTimeout(() => playerRef.current?.pauseVideo(), 500);
    }
  }, []);
  const previousVideo = useCallback(() => {
    if (!playerRef.current) return;
    const wasPaused =
      playerRef.current.getPlayerState() === window.YT.PlayerState.PAUSED;
    playerRef.current.previousVideo();
    if (wasPaused) {
      setTimeout(() => playerRef.current?.pauseVideo(), 500);
    }
  }, []);
  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    const state = playerRef.current.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, []);

  return {
    isReady,
    isPlaying,
    currentVideoTitle,
    loadPlaylist,
    nextVideo,
    previousVideo,
    togglePlay,
  };
}
