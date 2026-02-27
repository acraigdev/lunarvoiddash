'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDriveFolders,
  fetchDriveFolderImages,
  fetchDriveImageBlob,
  DriveFile,
} from '@/lib/google';
interface Props {
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  pageId?: string;
  className?: string;
}

function getStorageKey(pageId: string) {
  return `photos-drive-folder-${pageId}`;
}

function getNameStorageKey(pageId: string) {
  return `photos-drive-folder-name-${pageId}`;
}

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

  // ── Persisted folder selection ──────────────────────────────────
  const [folderId, setFolderId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(getStorageKey(pageId)) || '';
  });

  const [folderName, setFolderName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(getNameStorageKey(pageId)) || '';
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(-1);

  // ── Fetch folders (only when menu is open) ──────────────────────
  const { data: folders = [] } = useQuery({
    queryKey: ['drive', 'folders'],
    queryFn: () => fetchDriveFolders(session!.accessToken),
    enabled: menuOpen && !!session?.accessToken,
  });

  // ── Fetch images from selected folder ───────────────────────────
  const {
    data: imageFiles = EMPTY_FILES,
    isLoading,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['drive', 'images', folderId],
    queryFn: () => fetchDriveFolderImages(session!.accessToken, folderId),
    enabled: !!session?.accessToken && !!folderId,
    staleTime: 30 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  // ── Shuffled order ──────────────────────────────────────────────
  const shuffledFiles = useMemo(
    () => shuffle(imageFiles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageFiles, dataUpdatedAt],
  );

  // ── Slideshow state ─────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displaySlot, setDisplaySlot] = useState<0 | 1>(0);
  const [slots, setSlots] = useState<[string, string]>(['', '']);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  // ── Load first photo when items change ──────────────────────────
  useEffect(() => {
    setCurrentIndex(0);
    setDisplaySlot(0);
    setSlots(['', '']);

    if (shuffledFiles.length > 0 && session?.accessToken) {
      fetchDriveImageBlob(session.accessToken, shuffledFiles[0].id)
        .then(blobUrl => setSlots([blobUrl, '']))
        .catch(() => {});
    }
  }, [shuffledFiles, session?.accessToken]);

  // ── Advance to next photo ───────────────────────────────────────
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

  // ── Folder selection handler ────────────────────────────────────
  const handleFolderChange = useCallback(
    (id: string, name: string) => {
      setFolderId(id);
      setFolderName(name);
      localStorage.setItem(getStorageKey(pageId), id);
      localStorage.setItem(getNameStorageKey(pageId), name);
      setMenuOpen(false);
    },
    [pageId],
  );

  // ── Row layout: [header] [folder items if menu open...] ─────────
  const headerCount = 1;
  const listCount = menuOpen ? folders.length : 0;
  const totalCount = headerCount + listCount;

  // ── Activation / deactivation ───────────────────────────────────
  useEffect(() => {
    if (isActive && !wasActive.current) {
      setCursorIndex(totalCount > 0 ? 0 : -1);
    }
    if (!isActive && wasActive.current) {
      setCursorIndex(-1);
      setMenuOpen(false);
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
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursorIndex(i => Math.min(i + 1, totalCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursorIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Escape' && menuOpen) {
        e.preventDefault();
        setMenuOpen(false);
        setCursorIndex(0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setCursorIndex(i => {
          if (i === 0) {
            setMenuOpen(prev => !prev);
          } else if (
            menuOpen &&
            i >= headerCount &&
            i < headerCount + listCount
          ) {
            const folder = folders[i - headerCount];
            handleFolderChange(folder.id, folder.name);
            return 0;
          }
          return i;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
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
    folders,
    handleFolderChange,
    advance,
  ]);

  // ── Render ──────────────────────────────────────────────────────

  const statusText = !folderId
    ? 'Select a folder to display photos.'
    : isLoading
      ? 'Loading photos…'
      : isError
        ? 'Could not load photos.'
        : shuffledFiles.length === 0
          ? 'No images in this folder.'
          : null;

  const wrapperClass =
    'relative text-white overflow-hidden transition-all rounded-xl outline-offset-[-2px] max-h-full flex items-center justify-center hover:outline hover:outline-2 hover:outline-white/30' +
    (isActive
      ? ' outline outline-2 outline-white/60'
      : isFocused
        ? ' outline outline-2 outline-white/30'
        : '') +
    (className ? ` ${className}` : '');

  return (
    <div tabIndex={-1} className={wrapperClass} onClick={onActivate}>
      {/* Frame + slideshow: relative wrapper keeps slideshow aligned to the frame */}
      <div className="relative max-h-full max-w-full">
        <img
          src="/frame.png"
          alt=""
          className="max-w-full max-h-full block drop-shadow-xl"
        />

        {!statusText && shuffledFiles.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center -z-10 mt-3">
            <div
              className={
                'absolute w-3/5 h-3/5 bg-black flex items-center justify-center transition-opacity duration-1000' +
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
                'absolute w-3/5 h-3/5 bg-black flex items-center justify-center transition-opacity duration-1000' +
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
      </div>

      {/* Overlay UI: only visible when active */}
      {isActive && (
        <div className="absolute inset-0 flex flex-col p-4 z-10">
          {/* Header — current folder name, acts as menu toggle */}
          <div
            ref={el => {
              if (el) rowRefs.current.set(0, el);
              else rowRefs.current.delete(0);
            }}
            className={
              'text-xs font-bold uppercase tracking-widest rounded px-1.5 py-1.5 flex items-center justify-between gap-1.5 cursor-pointer' +
              (cursorIndex === 0 ? ' bg-black/40' : '')
            }
            onClick={e => {
              e.stopPropagation();
              setMenuOpen(prev => !prev);
              setCursorIndex(0);
            }}
          >
            {folderName || 'Photos'}
            <span className="text-xs opacity-40">{menuOpen ? '▲' : '▼'}</span>
          </div>

          {/* Folder picker menu */}
          {menuOpen && folders.length > 0 && (
            <div className="flex flex-col gap-1 mt-1 ml-2 border-l border-white/20 pl-2 max-h-48 overflow-y-auto">
              {folders.map((folder, i) => {
                const rowIndex = headerCount + i;
                const isCursor = rowIndex === cursorIndex;
                const isSelected = folder.id === folderId;

                return (
                  <span
                    key={folder.id}
                    ref={el => {
                      if (el) rowRefs.current.set(rowIndex, el);
                      else rowRefs.current.delete(rowIndex);
                    }}
                    className={
                      'text-xs font-bold uppercase tracking-widest rounded px-1.5 py-0.5 transition-all cursor-pointer' +
                      (isCursor ? ' bg-black/40' : '') +
                      (isSelected ? ' opacity-100' : ' opacity-50')
                    }
                    onClick={e => {
                      e.stopPropagation();
                      handleFolderChange(folder.id, folder.name);
                    }}
                  >
                    {folder.name}
                  </span>
                );
              })}
            </div>
          )}

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
