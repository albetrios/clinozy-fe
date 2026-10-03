import { useSearch } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isEditableElementFocused } from '@/lib/editable-focus.ts';
import { queryOf } from '@/lib/routes/search-params.ts';
import { cn } from '@/lib/utils.ts';
import { insideOverlay } from '@/shared/components/DataTable/useTableSelection.ts';
import {
  ROOM_TOOLBAR_KEYS,
  ROOM_TOOLBAR_NS,
  roomToolbarTestIds,
} from '@/shared/components/RoomToolbar/room-toolbar.constants.ts';
import { Label } from '@/shared/components/ui/label.tsx';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { Search } from '@/shared/icons/index.ts';

/** The list search's debounce (KICKOFF §6.0 Timers; S:1540). */
export const ROOM_SEARCH_DEBOUNCE_MS = 300;

/** The list search's longest query — the contract's `q` (S:1540). */
const SEARCH_QUERY_MAX = 80;

/** Props for {@link RoomSearch}. */
export interface RoomSearchProps {
  /** The room's placeholder ("Name, mobile or #ID"). */
  placeholder: string;
  /** The input's accessible name ("Search patients"). */
  label: string;
  /** Test-id prefix — the room's table id. */
  testIdPrefix: string;
  /** Placement classes from the toolbar (the phone row's flex and order). */
  className?: string;
}

/** A plain "/" — no modifier, not typed into a field or an open overlay. */
function isSearchShortcut(event: KeyboardEvent): boolean {
  if (event.key !== '/' || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  return !(isEditableElementFocused() || insideOverlay(event.target));
}

/**
 * A room list's search (KICKOFF §3.5 List toolbar; H:1087, H:294–298): from
 * `md` a 36px square while empty and unfocused, opening on a click or "/" to
 * 200px (150–220) in 220ms and staying open while it holds text; on a phone
 * always open, 40px, without the "/" hint. Typing reaches the URL's `q` 300ms
 * after the last key — clearing reaches it at once — and a `q` changed
 * elsewhere (Back, a shared link) shows here.
 */
export function RoomSearch({
  placeholder,
  label,
  testIdPrefix,
  className,
}: RoomSearchProps) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  const ids = roomToolbarTestIds(testIdPrefix);
  const search: { q?: unknown } = useSearch({ strict: false });
  const applied = queryOf(search.q, SEARCH_QUERY_MAX) ?? '';
  const { patchSearch } = useDataTableUrlState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [text, setText] = useState(applied);
  const [focused, setFocused] = useState(false);
  // The `q` this box last wrote, and the URL's `q` it last saw: a change it
  // did not write came from elsewhere, so the box shows it.
  const [written, setWritten] = useState(applied);
  const [seen, setSeen] = useState(applied);
  if (applied !== seen) {
    setSeen(applied);
    if (applied !== written) {
      setWritten(applied);
      setText(applied);
    }
  }
  const expanded = focused || text !== '';

  const write = (query: string) => {
    setWritten(query);
    patchSearch({ q: query === '' ? undefined : query });
  };

  const onType = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    const query = queryOf(value, SEARCH_QUERY_MAX) ?? '';
    if (query === '') {
      if (written !== '') write('');
      return;
    }
    timer.current = setTimeout(() => write(query), ROOM_SEARCH_DEBOUNCE_MS);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isSearchShortcut(event)) return;
    event.preventDefault();
    inputRef.current?.focus();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <Label
      data-slot="room-search"
      data-expanded={expanded}
      data-testid={ids.search}
      title={t(ROOM_TOOLBAR_KEYS.searchTitle)}
      className={cn(
        // The Label's own weight and selection rule would reach the input (it inherits font).
        'border-border bg-background text-muted-foreground relative flex h-10 min-w-0 cursor-text items-center gap-2 rounded-lg border px-3 font-normal select-auto',
        'focus-within:border-disabled focus-within:ring-ring/50 focus-within:ring-[3px]',
        '[transition:flex-basis_220ms_cubic-bezier(.2,.8,.2,1),max-width_220ms_cubic-bezier(.2,.8,.2,1),min-width_220ms_cubic-bezier(.2,.8,.2,1),background-color_120ms_ease]',
        'md:h-9 md:max-w-55 md:min-w-37.5 md:flex-[0_1_200px] md:px-2.5',
        // Folded to the 36px square (the hover fill and pointer as the design's, H:296).
        !expanded &&
          'hover:bg-muted cursor-pointer md:max-w-9 md:min-w-9 md:flex-[0_0_36px] md:justify-center md:px-0',
        className,
      )}
    >
      <Search aria-hidden="true" className="size-3.75 flex-none" />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        inputMode="search"
        value={text}
        maxLength={SEARCH_QUERY_MAX}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        onChange={(event) => onType(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur();
        }}
        className={cn(
          'text-field text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none',
          // Folded, the input stays focusable ("/", Tab) and a click on the square reaches it.
          !expanded && 'md:sr-only',
        )}
      />
      {/* The "/" key hint — the title says it for everyone else. */}
      <span
        aria-hidden="true"
        className={cn(
          'border-border bg-canvas text-micro text-muted-foreground flex h-4.5 min-w-4.5 flex-none items-center justify-center rounded-sm border px-1 leading-none font-normal max-md:hidden',
          !expanded && 'md:hidden',
        )}
      >
        /
      </span>
    </Label>
  );
}
