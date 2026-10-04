import type { RowData } from '@tanstack/react-table';
import { type RefObject, useEffect, useEffectEvent, useState } from 'react';

import { isEditableElementFocused } from '@/lib/editable-focus.ts';

import type { TableRow } from './data-table-layout.ts';
import { insideOverlay } from './useTableSelection.ts';

interface RowKeyboardNavOptions<TData extends RowData> {
  enabled: boolean;
  rows: readonly TableRow<TData>[];
  onOpen: ((row: TableRow<TData>) => void) | undefined;
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Brings a virtualised row into the rendered window, by its row index. */
  scrollToIndex: (index: number) => void;
}

/** A plain key press outside any field or open overlay. */
function isOurKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey)
    return false;
  return !(isEditableElementFocused() || insideOverlay(event.target));
}

/**
 * j / k row focus and Enter to open (the Leads list, `_patterns.md:273`;
 * H:4510): j moves down, k up, both clamped; Enter opens the focused row. Keys
 * typed into a field or an open overlay, or with a modifier, are not ours.
 * Returns the focused row's index.
 */
export function useRowKeyboardNav<TData extends RowData>({
  enabled,
  rows,
  onOpen,
  scrollerRef,
  scrollToIndex,
}: RowKeyboardNavOptions<TData>): number | null {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (!isOurKey(event)) return;
    if (event.key === 'j' || event.key === 'k') {
      if (rows.length === 0) return;
      event.preventDefault();
      const current = focusIndex ?? -1;
      setFocusIndex(
        event.key === 'j'
          ? Math.min(rows.length - 1, current + 1)
          : Math.max(0, current - 1),
      );
      return;
    }
    const row = focusIndex === null ? undefined : rows[focusIndex];
    if (event.key === 'Enter' && row && onOpen) {
      event.preventDefault();
      onOpen(row);
    }
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [enabled]);

  const focusRow = useEffectEvent((index: number) => {
    scrollToIndex(index);
    return requestAnimationFrame(() => {
      const node = scrollerRef.current?.querySelector<HTMLElement>(
        `[data-row-index="${index}"]`,
      );
      node?.focus({ preventScroll: true });
      node?.scrollIntoView?.({ block: 'nearest' });
    });
  });
  useEffect(() => {
    if (focusIndex === null) return undefined;
    const frame = focusRow(focusIndex);
    return () => cancelAnimationFrame(frame);
  }, [focusIndex]);

  return enabled ? focusIndex : null;
}
