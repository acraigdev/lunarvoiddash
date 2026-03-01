'use client';

import { Maybe } from '@/lib/typeHelpers';
import {
  ReactNode,
  Ref,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';

interface ZoneContainerProps {
  children: ReactNode;
  isFocused?: boolean;
  isActive?: boolean;
  className?: string;
  ref?: Maybe<Ref<HTMLDivElement>>;
  onClick?: () => void;
}

export function ZoneContainer({
  children,
  isFocused,
  isActive,
  className,
  ref,
  onClick,
}: ZoneContainerProps) {
  const scrollElRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Combined ref callback — sets both our internal ref and the external one
  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (scrollElRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && typeof ref === 'object') {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const updateScrollState = useCallback(() => {
    const el = scrollElRef.current;
    if (!el) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  // Track scroll position + content size changes
  useEffect(() => {
    const el = scrollElRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState);
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState, children]);

  const stopScrolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startScrolling = useCallback(
    (direction: 'up' | 'down') => {
      stopScrolling();
      const el = scrollElRef.current;
      if (!el) return;
      const amount = direction === 'up' ? -4 : 4;
      intervalRef.current = setInterval(() => {
        el.scrollBy({ top: amount });
      }, 16);
    },
    [stopScrolling],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopScrolling();
  }, [stopScrolling]);

  const widgetClass =
    'text-white rounded-xl bg-gray-dark/50 backdrop-blur-xs max-h-full overflow-hidden transition-all relative outline-offset-[-2px]' +
    (onClick ? ' hover:outline hover:outline-2 hover:outline-white/30' : '') +
    (isActive
      ? ' outline outline-2 outline-white/60'
      : isFocused
        ? ' outline outline-2 outline-white/30'
        : '') +
    (className ? ` ${className}` : '');

  return (
    <div tabIndex={-1} className={widgetClass} onClick={onClick}>
      {isActive && canScrollUp && (
        <div
          className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center bg-linear-to-b from-black/50 to-transparent z-10 cursor-pointer rounded-t-xl"
          onMouseEnter={() => startScrolling('up')}
          onMouseLeave={stopScrolling}
        >
          <span className="text-white/70 text-xs">▲</span>
        </div>
      )}
      <div ref={combinedRef} className="p-4 overflow-y-auto max-h-full">
        {children}
      </div>
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
