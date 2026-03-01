'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { NAV_KEYS } from '@/lib/keys';
import {
  fetchDriveFolders,
  fetchDriveFolderImages,
  fetchDriveImageBlob,
  DriveFile,
} from '@/lib/google';
import { Dropdown, DropdownHandle } from '../Dropdown';

interface Props {
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  pageId?: string;
  className?: string;
}

const STORAGE_PREFIX = 'photos-drive-folder-';

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const EMPTY_FILES: DriveFile[] = [];

export function PhotoWidget({
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
  const frameRef = useRef<HTMLImageElement>(null);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(
    null,
  );

  useEffect(() => {
    const img = frameRef.current;
    if (!img) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setFrameSize({ w: width, h: height });
    });
    ro.observe(img);
    return () => ro.disconnect();
  }, []);

  // Local selectedId so image queries work even when Dropdown isn't mounted
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + pageId);
    if (saved) setSelectedId(JSON.parse(saved).id);
  }, [pageId]);

  const [cursorIndex, setCursorIndex] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const cursorIndexRef = useRef(cursorIndex);
  cursorIndexRef.current = cursorIndex;

  const { data: folders = [] } = useQuery({
    queryKey: ['drive', 'folders'],
    queryFn: () => fetchDriveFolders(session!.accessToken),
    enabled: menuOpen && !!session?.accessToken,
  });

  const {
    data: imageFiles = EMPTY_FILES,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['drive', 'images', selectedId],
    queryFn: () => fetchDriveFolderImages(session!.accessToken, selectedId),
    enabled: !!session?.accessToken && !!selectedId,
    staleTime: 30 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  const imageFileIds = imageFiles.map(f => f.id).join(',');
  const shuffledFiles = useMemo(
    () => shuffle(imageFiles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageFileIds],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [displaySlot, setDisplaySlot] = useState<0 | 1>(0);
  const [slots, setSlots] = useState<[string, string]>(['', '']);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);
  const accessTokenRef = useRef(session?.accessToken);
  accessTokenRef.current = session?.accessToken;

  useEffect(() => {
    setCurrentIndex(0);
    setDisplaySlot(0);
    setSlots(['', '']);

    if (shuffledFiles.length > 0 && accessTokenRef.current) {
      fetchDriveImageBlob(accessTokenRef.current, shuffledFiles[0].id)
        .then(blobUrl => setSlots([blobUrl, '']))
        .catch(() => {});
    }
  }, [shuffledFiles]);

  const advance = useCallback(() => {
    if (
      shuffledFiles.length <= 1 ||
      !session?.accessToken ||
      loadingRef.current
    )
      return;
    loadingRef.current = true;

    const nextIndex = (currentIndex + 1) % shuffledFiles.length;
    const nextSlot: 0 | 1 = displaySlot === 0 ? 1 : 0;

    fetchDriveImageBlob(session.accessToken, shuffledFiles[nextIndex].id)
      .then(blobUrl => {
        setSlots(prev => {
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
        setCurrentIndex(nextIndex);
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [shuffledFiles, currentIndex, displaySlot, session?.accessToken]);

  // ── Auto-advance timer (30s) ────────────────────────────────────
  useEffect(() => {
    if (shuffledFiles.length <= 1) return;
    timerRef.current = setTimeout(advance, 30_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [advance, shuffledFiles.length, currentIndex]);

  const dropdownItems = useMemo(
    () => folders.map((f: any) => ({ id: f.id, label: f.name })),
    [folders],
  );

  // ── Row layout: [header] [folder items if menu open...] ─────────
  const headerCount = 1;
  const listCount = menuOpen ? dropdownItems.length : 0;
  const totalCount = headerCount + listCount;

  // ── Activation / deactivation ───────────────────────────────────
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

  // ── Scroll active row into view ─────────────────────────────────
  useEffect(() => {
    if (cursorIndex >= 0) {
      rowRefs.current.get(cursorIndex)?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursorIndex]);

  // ── Keyboard navigation ─────────────────────────────────────────
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
        }
      } else if (e.key === 'ArrowRight') {
        advance();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, totalCount, headerCount, listCount, menuOpen, advance]);

  // ── Render ──────────────────────────────────────────────────────

  const statusText = !selectedId
    ? 'Select a folder to display photos.'
    : isLoading && shuffledFiles.length === 0
      ? 'Loading photos…'
      : isError && shuffledFiles.length === 0
        ? 'Could not load photos.'
        : shuffledFiles.length === 0
          ? 'No images in this folder.'
          : null;

  const wrapperClass =
    'relative text-white overflow-hidden transition-all rounded-xl outline-offset-[-2px] h-full flex items-center justify-center hover:outline hover:outline-2 hover:outline-white/30' +
    (isActive
      ? ' outline outline-2 outline-white/60'
      : isFocused
        ? ' outline outline-2 outline-white/30'
        : '') +
    (className ? ` ${className}` : '');

  const slideshowStyle: CSSProperties | undefined = frameSize
    ? {
        width: frameSize.w * 0.6,
        height: frameSize.h * 0.51,
        top: '52%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    : undefined;

  return (
    <div tabIndex={-1} className={wrapperClass} onClick={onActivate}>
      {/* Frame as direct flex child so max-h-full resolves against the wrapper's definite h-full */}
      <img
        ref={frameRef}
        src="/frame.png"
        alt=""
        className="max-w-full max-h-full block drop-shadow-xl pointer-events-none relative z-10"
      />

      {/* Slideshow: absolutely positioned + sized via measured frame dimensions */}
      {!statusText && shuffledFiles.length > 0 && slideshowStyle && (
        <div className="absolute -z-10 bg-black" style={slideshowStyle}>
          <div
            className={
              'absolute inset-0 flex items-center justify-center transition-opacity duration-1000' +
              (displaySlot === 0 ? ' opacity-100' : ' opacity-0')
            }
          >
            {slots[0] && (
              <img
                src={slots[0]}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
          <div
            className={
              'absolute inset-0 flex items-center justify-center transition-opacity duration-1000' +
              (displaySlot === 1 ? ' opacity-100' : ' opacity-0')
            }
          >
            {slots[1] && (
              <img
                src={slots[1]}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* Overlay UI: only visible when active */}
      {isActive && (
        <div className="absolute inset-0 flex flex-col p-4 z-10">
          <Dropdown
            ref={ddRef}
            storageKey={STORAGE_PREFIX + pageId}
            defaultLabel="Photos"
            items={dropdownItems}
            isActive={isActive}
            cursorIndex={cursorIndex}
            rowRefs={rowRefs}
            onSelect={id => setSelectedId(id)}
            onMenuChange={setMenuOpen}
            menuClassName="max-h-48 overflow-y-auto"
          />

          {/* Status text centered */}
          {statusText && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm opacity-60">{statusText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
