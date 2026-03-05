'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface Props {
  url: string | null;
  fallbackTitle: string | null;
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  className?: string;
}

export function ReaderWidget({
  url,
  isFocused,
  isActive,
  onActivate,
  className,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const scrollTop = win.scrollY;
    const clientHeight = win.innerHeight;
    const scrollHeight = Math.max(
      win.document.body?.scrollHeight ?? 0,
      win.document.documentElement?.scrollHeight ?? 0,
    );
    setCanScrollUp(scrollTop > 0);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 1);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function onLoad() {
      const doc = iframe!.contentDocument;
      if (doc?.head) {
        const style = doc.createElement('style');
        style.textContent =
          '::-webkit-scrollbar:horizontal{display:none}html,body{overflow-x:hidden!important}';
        doc.head.appendChild(style);
      }
      // Delay so page layout/CSS finishes before measuring
      setTimeout(updateScrollState, 300);
      const win = iframe!.contentWindow;
      if (!win) return;
      win.addEventListener('scroll', updateScrollState);
    }

    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      setCanScrollUp(false);
      setCanScrollDown(false);
    };
  }, [url, updateScrollState]);

  const stopScrolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startScrolling = useCallback(
    (direction: 'up' | 'down') => {
      stopScrolling();
      const amount = direction === 'up' ? -4 : 4;
      intervalRef.current = setInterval(() => {
        iframeRef.current?.contentWindow?.scrollBy({ top: amount });
        updateScrollState();
      }, 16);
    },
    [stopScrolling, updateScrollState],
  );

  useEffect(() => () => stopScrolling(), [stopScrolling]);

  const wrapperClass =
    'text-white rounded-xl bg-gray-dark/50 backdrop-blur-xs max-h-full overflow-hidden transition-all relative outline-offset-[-2px]' +
    (onActivate
      ? ' hover:outline hover:outline-2 hover:outline-white/30'
      : '') +
    (isActive
      ? ' outline outline-2 outline-white/60'
      : isFocused
        ? ' outline outline-2 outline-white/30'
        : '') +
    (className ? ` ${className}` : '');

  if (!url) {
    return (
      <div className={wrapperClass} onClick={onActivate}>
        <div className="flex items-center justify-center h-full min-h-40 px-5 py-4">
          <p className="text-sm opacity-40">Select a link to read</p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} onClick={onActivate}>
      {isActive && canScrollUp && (
        <div
          className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center bg-linear-to-b from-black/50 to-transparent z-10 cursor-pointer rounded-t-xl"
          onMouseEnter={() => startScrolling('up')}
          onMouseLeave={stopScrolling}
        >
          <span className="text-white/70 text-xs">▲</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={`/api/proxy?url=${encodeURIComponent(url)}`}
        title="Reader"
        className="w-full h-full rounded-xl"
        // pointer-events-none when inactive so the wrapper's onClick fires on click
        style={{ pointerEvents: isActive ? 'auto' : 'none' }}
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
      {isActive && canScrollDown && (
        <div
          className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-center bg-linear-to-t from-black/50 to-transparent z-10 cursor-pointer rounded-b-xl"
          onMouseEnter={() => startScrolling('down')}
          onMouseLeave={stopScrolling}
        >
          <span className="text-white/70 text-xs">▼</span>
        </div>
      )}
    </div>
  );
}
