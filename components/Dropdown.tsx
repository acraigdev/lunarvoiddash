'use client';

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';

export interface DropdownItem {
  id: string;
  label: string;
}

export interface DropdownHandle {
  menuOpen: boolean;
  itemCount: number;
  selectedId: string;
  selectedName: string;
  toggleMenu: () => void;
  closeMenu: () => void;
  selectAtIndex: (index: number) => void;
}

interface DropdownProps {
  storageKey: string;
  defaultLabel: string;
  items: DropdownItem[];
  onSelect?: (id: string, name: string) => void;
  onMenuChange?: (open: boolean) => void;
  isActive?: boolean;
  cursorIndex: number;
  headerRowIndex?: number;
  rowRefs: React.MutableRefObject<Map<number, HTMLElement>>;
  menuClassName?: string;
}

export const Dropdown = forwardRef<DropdownHandle, DropdownProps>(
  function Dropdown(
    {
      storageKey,
      defaultLabel,
      items,
      onSelect,
      onMenuChange,
      isActive,
      cursorIndex,
      headerRowIndex = 0,
      rowRefs,
      menuClassName,
    },
    ref,
  ) {
    const [selectedId, setSelectedId] = useState('');
    const [selectedName, setSelectedName] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuOpenRef = useRef(false);
    menuOpenRef.current = menuOpen;

    // Keep callbacks in refs so effects don't re-run when they change
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onMenuChangeRef = useRef(onMenuChange);
    onMenuChangeRef.current = onMenuChange;

    useEffect(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id) setSelectedId(parsed.id);
          if (parsed?.name) setSelectedName(parsed.name);
        }
      } catch {
        // ignore corrupt storage
      }
    }, [storageKey]);

    const select = useCallback(
      (id: string, name: string) => {
        setSelectedId(id);
        setSelectedName(name);
        localStorage.setItem(storageKey, JSON.stringify({ id, name }));
        setMenuOpen(false);
        onMenuChangeRef.current?.(false);
        onSelectRef.current?.(id, name);
      },
      [storageKey],
    );

    const toggleMenu = useCallback(() => {
      const next = !menuOpenRef.current;
      setMenuOpen(next);
      onMenuChangeRef.current?.(next);
    }, []);
    const closeMenu = useCallback(() => {
      setMenuOpen(false);
      onMenuChangeRef.current?.(false);
    }, []);

    const selectAtIndex = useCallback(
      (index: number) => {
        if (index >= 0 && index < items.length) {
          select(items[index].id, items[index].label);
        }
      },
      [items, select],
    );

    const itemCount = menuOpen ? items.length : 0;

    useImperativeHandle(
      ref,
      () => ({
        menuOpen,
        itemCount,
        selectedId,
        selectedName,
        toggleMenu,
        closeMenu,
        selectAtIndex,
      }),
      [
        menuOpen,
        itemCount,
        selectedId,
        selectedName,
        toggleMenu,
        closeMenu,
        selectAtIndex,
      ],
    );

    return (
      <>
        {/* Header — acts as menu toggle */}
        <div
          ref={el => {
            if (el) rowRefs.current.set(headerRowIndex, el);
            else rowRefs.current.delete(headerRowIndex);
          }}
          className={
            'text-xs font-bold uppercase tracking-widest mb-2 rounded px-1.5 py-1.5 flex items-center justify-between gap-1.5 cursor-pointer' +
            (isActive && cursorIndex === headerRowIndex ? ' bg-white/20' : '')
          }
          onClick={e => {
            e.stopPropagation();
            toggleMenu();
          }}
        >
          {selectedName || defaultLabel}
          <span className="text-xs opacity-40">{menuOpen ? '▲' : '▼'}</span>
        </div>

        {/* Menu items */}
        {menuOpen && items.length > 0 && (
          <div
            className={
              'flex flex-col gap-1 mb-3 ml-2 border-l border-white/10 pl-2' +
              (menuClassName ? ` ${menuClassName}` : '')
            }
          >
            {items.map((item, i) => {
              const rowIndex = headerRowIndex + 1 + i;
              const isCursor = isActive && rowIndex === cursorIndex;
              const isSelected = item.id === selectedId;

              return (
                <span
                  key={item.id}
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
                    select(item.id, item.label);
                  }}
                >
                  {item.label}
                </span>
              );
            })}
          </div>
        )}
      </>
    );
  },
);
