'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTasks, completeTask, fetchTaskLists } from '@/lib/google';
import { NAV_KEYS } from '@/lib/keys';
import { ZoneContainer } from '../ZoneContainer';
import { Nullable } from '@/lib/typeHelpers';
import { Dropdown, DropdownHandle } from '../Dropdown';

interface Props {
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  onSelectLink?: (url: Nullable<string>, title: string) => void;
  pageId?: string;
  className?: string;
}

const STORAGE_PREFIX = 'tasks-selected-list-';

/** Extract the first URL from a task's notes field. */
function extractUrl(notes: string | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
  return match ? match[0] : null;
}

export function TaskWidget({
  isFocused,
  isActive,
  onActivate,
  onSelectLink,
  pageId = 'default',
  className,
}: Props) {
  const { data: session } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const wasActive = useRef(false);
  const ddRef = useRef<DropdownHandle>(null);

  const [cursorIndex, setCursorIndex] = useState(-1);
  const [selectedListId, setSelectedListId] = useState('@default');
  const [menuOpen, setMenuOpen] = useState(false);
  const cursorIndexRef = useRef(cursorIndex);
  cursorIndexRef.current = cursorIndex;

  // Migrate old separate-key storage (plain string id + separate name key) to JSON
  useEffect(() => {
    const key = STORAGE_PREFIX + pageId;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          setSelectedListId(parsed.id);
          return; // already migrated
        }
      } catch {
        // not valid JSON — old format (plain string id)
      }
      // raw is the old plain-string list id
      const oldName = localStorage.getItem(`tasks-selected-list-name-${pageId}`);
      localStorage.setItem(key, JSON.stringify({ id: raw, name: oldName || 'Tasks' }));
      localStorage.removeItem(`tasks-selected-list-name-${pageId}`);
      setSelectedListId(raw);
    }
  }, [pageId]);

  // Only fetch task lists when the menu is open
  const { data: taskLists = [] } = useQuery({
    queryKey: ['tasks', 'fetchTaskLists'],
    queryFn: () => fetchTaskLists(session!.accessToken),
    enabled: menuOpen && !!session?.accessToken,
  });

  const {
    data: tasks = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['tasks', selectedListId],
    queryFn: () => fetchTasks(session!.accessToken, selectedListId),
    enabled: !!session?.accessToken && !!selectedListId,
    refetchInterval: () => {
      const h = new Date().getHours();
      return h >= 0 && h < 8 ? false : 5 * 60_000;
    },
  });

  const mutation = useMutation({
    mutationFn: (taskId: string) =>
      completeTask(session!.accessToken, selectedListId, taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedListId] }),
  });

  // ── Delayed completion: 3s grace period to undo ─────────────────
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const toggleComplete = useCallback((taskId: string) => {
    const existing = pendingTimers.current.get(taskId);
    if (existing) {
      clearTimeout(existing);
      pendingTimers.current.delete(taskId);
      setPendingIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
    } else {
      const timer = setTimeout(() => {
        pendingTimers.current.delete(taskId);
        setPendingIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
        mutation.mutate(taskId);
      }, 3000);
      pendingTimers.current.set(taskId, timer);
      setPendingIds(prev => new Set(prev).add(taskId));
    }
  }, [mutation]);

  useEffect(() => {
    return () => { pendingTimers.current.forEach(t => clearTimeout(t)); };
  }, []);

  const dropdownItems = useMemo(
    () => taskLists.map((l: any) => ({ id: l.id, label: l.title })),
    [taskLists],
  );

  // Row layout: [header] [list items if menu open...] [task items...]
  const headerCount = 1;
  const listCount = menuOpen ? dropdownItems.length : 0;
  const totalCount = headerCount + listCount + tasks.length;

  // On activation: reset cursor. On deactivation: close menu.
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

  // Scroll active row into view
  useEffect(() => {
    if (cursorIndex >= 0) {
      rowRefs.current.get(cursorIndex)?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursorIndex]);

  // Keyboard navigation when zone is active
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
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
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
          const taskIndex = i - headerCount - listCount;
          if (taskIndex >= 0 && taskIndex < tasks.length) {
            const task = tasks[taskIndex];
            const url = extractUrl(task.notes);
            if (onSelectLink) onSelectLink(url, task.title);
          }
        }
      } else if (e.key === 'ArrowLeft') {
        const i = cursorIndexRef.current;
        const taskIndex = i - headerCount - listCount;
        if (taskIndex >= 0 && taskIndex < tasks.length) {
          toggleComplete(tasks[taskIndex].id);
        }
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
    tasks,
    onSelectLink,
    mutation,
  ]);

  if (isLoading) {
    return (
      <ZoneContainer>
        <p className="text-sm opacity-60">Loading tasks…</p>
      </ZoneContainer>
    );
  }

  if (isError) {
    return (
      <ZoneContainer>
        <p className="text-sm opacity-60">Could not load tasks.</p>
      </ZoneContainer>
    );
  }

  return (
    <ZoneContainer
      ref={scrollRef}
      isFocused={isFocused}
      isActive={isActive}
      className={className}
      onClick={onActivate}
    >
      <Dropdown
        ref={ddRef}
        storageKey={STORAGE_PREFIX + pageId}
        defaultLabel="Tasks"
        items={dropdownItems}
        isActive={isActive}
        cursorIndex={cursorIndex}
        rowRefs={rowRefs}
        onSelect={id => setSelectedListId(id)}
        onMenuChange={setMenuOpen}
      />

      {/* Task items */}
      {tasks.length === 0 ? (
        <p className="text-sm opacity-60">No tasks.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task, i) => {
            const rowIndex = headerCount + listCount + i;
            const isCursor = isActive && rowIndex === cursorIndex;
            const url = extractUrl(task.notes);

            return (
              <li
                key={task.id}
                ref={el => {
                  if (el) rowRefs.current.set(rowIndex, el);
                  else rowRefs.current.delete(rowIndex);
                }}
                className={
                  'flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors' +
                  (isCursor ? ' bg-white/20' : '')
                }
              >
                <span
                  className={
                    'w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] transition-colors cursor-pointer' +
                    (pendingIds.has(task.id) ? ' border-white bg-white/30' : isCursor ? ' border-white' : ' border-white/40')
                  }
                  onClick={e => {
                    e.stopPropagation();
                    toggleComplete(task.id);
                  }}
                >
                  {pendingIds.has(task.id) && '✓'}
                </span>
                <span
                  className="text-sm font-medium line-clamp-2 flex-1 cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    if (!isActive) onActivate?.();
                    if (onSelectLink) onSelectLink(url, task.title);
                  }}
                >
                  {task.title}
                </span>
                {url && <span className="text-xs opacity-40 shrink-0">🔗</span>}
              </li>
            );
          })}
        </ul>
      )}
    </ZoneContainer>
  );
}

export { TaskWidget as TaskList };
