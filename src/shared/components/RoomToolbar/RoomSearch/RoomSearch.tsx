import { useSearch } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isEditableElementFocused } from '@/lib/editable-focus.ts';
import { queryOf } from '@/lib/routes/search-params.ts';
import { insideOverlay } from '@/shared/components/DataTable/useTableSelection.ts';
import {
  ROOM_TOOLBAR_KEYS,
  ROOM_TOOLBAR_NS,
  roomToolbarTestIds,
} from '@/shared/components/RoomToolbar/room-toolbar.constants.ts';
import { RoomSearchField } from '@/shared/components/RoomToolbar/RoomSearchField/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';

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
  /**
   * Open, the field is 200px (150–220) — or `wide`, the Tasks room's 220px
   * with no upper bound (H:2133).
   */
  width?: 'default' | 'wide';
  /** The "/" key hint inside the open field (default on; the Tasks field draws none, H:2133). */
  keyHint?: boolean;
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
  width = 'default',
  keyHint = true,
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
    <RoomSearchField
      value={text}
      onValueChange={onType}
      placeholder={placeholder}
      label={label}
      width={width}
      keyHint={keyHint}
      maxLength={SEARCH_QUERY_MAX}
      title={t(ROOM_TOOLBAR_KEYS.searchTitle)}
      testId={ids.search}
      inputRef={inputRef}
      className={className}
    />
  );
}
