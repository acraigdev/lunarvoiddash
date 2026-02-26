'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTasks, completeTask, fetchTaskLists } from '@/lib/google';
import { ZoneContainer } from '../ZoneContainer';

interface Props {
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  pageId?: string;
  className?: string;
}

function getStorageKey(pageId: string) {
  return `tasks-selected-list-${pageId}`;
}

function getNameStorageKey(pageId: string) {
  return `tasks-selected-list-name-${pageId}`;
}

// TODO: review this probably doesn't need to be so complicated
export function TaskWidget({
  isFocused,
  isActive,
  onActivate,
  pageId = 'default',
  className,
}: Props) {
  const { data: session } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [selectedListId, setSelectedListId] = useState<string>(() => {
    if (typeof window === 'undefined') return '@default';
    return localStorage.getItem(getStorageKey(pageId)) || '@default';
  });

  const [selectedListName, setSelectedListName] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Tasks';
    return localStorage.getItem(getNameStorageKey(pageId)) || 'Tasks';
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(-1);
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const wasActive = useRef(false);

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
  });

  const mutation = useMutation({
    mutationFn: (taskId: string) =>
      completeTask(session!.accessToken, selectedListId, taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedListId] }),
  });

  const handleListChange = useCallback(
    (listId: string, listName: string) => {
      setSelectedListId(listId);
      setSelectedListName(listName);
      localStorage.setItem(getStorageKey(pageId), listId);
      localStorage.setItem(getNameStorageKey(pageId), listName);
      setMenuOpen(false);
    },
    [pageId],
  );

  // Row layout: [header] [list items if menu open...] [task items...]
  const headerCount = 1;
  const listCount = menuOpen ? taskLists.length : 0;
  const totalCount = headerCount + listCount + tasks.length;

  // On activation: reset cursor to first row (header)
  // On deactivation: commit queued items and reset
  useEffect(() => {
    if (isActive && !wasActive.current) {
      setCursorIndex(totalCount > 0 ? 0 : -1);
    }
    if (!isActive && wasActive.current) {
      if (queued.size > 0) {
        for (const id of queued) {
          mutation.mutate(id);
        }
        setQueued(new Set());
      }
      setCursorIndex(-1);
      setMenuOpen(false);
    }
    wasActive.current = isActive ?? false;
  }, [isActive, totalCount, queued, mutation]);

  // Scroll active row into view
  useEffect(() => {
    if (cursorIndex >= 0) {
      rowRefs.current.get(cursorIndex)?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursorIndex]);

  const toggleQueued = useCallback((taskId: string) => {
    setQueued(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Keyboard navigation when zone is active
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
            // Header row — toggle the list picker menu
            setMenuOpen(prev => !prev);
          } else if (
            menuOpen &&
            i >= headerCount &&
            i < headerCount + listCount
          ) {
            // Selecting a list from the menu
            const list = taskLists[i - headerCount];
            handleListChange(list.id, list.title);
            return 0;
          } else {
            // Task item — toggle queued
            const taskIndex = i - headerCount - listCount;
            if (taskIndex >= 0 && taskIndex < tasks.length) {
              toggleQueued(tasks[taskIndex].id);
            }
          }
          return i;
        });
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
    taskLists,
    tasks,
    toggleQueued,
    handleListChange,
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
      {/* Header — current list name, acts as menu toggle */}
      <div
        ref={el => {
          if (el) rowRefs.current.set(0, el);
          else rowRefs.current.delete(0);
        }}
        className={
          'text-xs font-bold uppercase tracking-widest mb-3 rounded px-1.5 py-0.5 flex items-center gap-1.5 cursor-pointer' +
          (isActive && cursorIndex === 0 ? ' bg-white/20' : '')
        }
        onClick={e => {
          e.stopPropagation();
          if (!isActive) onActivate?.();
          setMenuOpen(prev => !prev);
          setCursorIndex(0);
        }}
      >
        {selectedListName}
        <span className="text-[10px] opacity-40">{menuOpen ? '▲' : '▼'}</span>
      </div>

      {/* List picker menu (only rendered when open) */}
      {menuOpen && taskLists.length > 0 && (
        <div className="flex flex-col gap-1 mb-3 ml-2 border-l border-white/10 pl-2">
          {taskLists.map((list, i) => {
            const rowIndex = headerCount + i;
            const isCursor = isActive && rowIndex === cursorIndex;
            const isSelected = list.id === selectedListId;

            return (
              <span
                key={list.id}
                ref={el => {
                  if (el) rowRefs.current.set(rowIndex, el);
                  else rowRefs.current.delete(rowIndex);
                }}
                className={
                  'text-xs font-bold uppercase tracking-widest rounded px-1.5 py-0.5 transition-all cursor-pointer' +
                  (isCursor ? ' bg-white/20' : '') +
                  (isSelected ? ' opacity-100' : ' opacity-40')
                }
                onClick={e => {
                  e.stopPropagation();
                  handleListChange(list.id, list.title);
                }}
              >
                {list.title}
              </span>
            );
          })}
        </div>
      )}

      {/* Task items */}
      {tasks.length === 0 ? (
        <p className="text-sm opacity-60">No tasks.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task, i) => {
            const rowIndex = headerCount + listCount + i;
            const isQueued = queued.has(task.id);
            const isCursor = isActive && rowIndex === cursorIndex;

            return (
              <li
                key={task.id}
                ref={el => {
                  if (el) rowRefs.current.set(rowIndex, el);
                  else rowRefs.current.delete(rowIndex);
                }}
                className={
                  'flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors cursor-pointer' +
                  (isCursor ? ' bg-white/20' : '')
                }
                onClick={e => {
                  e.stopPropagation();
                  if (!isActive) onActivate?.();
                  toggleQueued(task.id);
                }}
              >
                <span
                  className={
                    'w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] transition-colors' +
                    (isQueued
                      ? ' bg-white/80 border-white text-black'
                      : isCursor
                        ? ' border-white'
                        : ' border-white/40')
                  }
                >
                  {isQueued && '✓'}
                </span>
                <span
                  className={
                    'text-sm font-medium truncate transition-opacity' +
                    (isQueued ? ' line-through opacity-40' : '')
                  }
                >
                  {task.title}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ZoneContainer>
  );
}

export { TaskWidget as TaskList };
