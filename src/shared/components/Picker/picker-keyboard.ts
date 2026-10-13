import type { KeyboardEvent } from 'react';

import { PICKER_LOAD_MORE_ROWS, PICKER_PAGE_JUMP } from './picker.constants.ts';
import { activateItem, activeItem, enabledItems } from './picker-dom.ts';
import { nextLabelMatch } from './picker-rows.ts';

/** What {@link handlePickerKey} needs from the picker. */
export interface PickerKeyContext {
  /** The cmdk list element. */
  list: HTMLElement | null;
  searchable: boolean;
  /** The label of the row with this cmdk value (type-ahead). */
  labelOf: (value: string) => string;
  loadMore: () => void;
  /** Close as a dismissal (auto-create applies). */
  dismiss: () => void;
}

function isTypeAheadKey(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
}

function nearEnd(count: number, index: number): boolean {
  return count > 0 && index >= count - PICKER_LOAD_MORE_ROWS;
}

/** PgUp / PgDn: ±8 rows, clamped to the enabled rows; PgDn near the end loads more. */
function jumpRows(
  event: KeyboardEvent<HTMLElement>,
  items: HTMLElement[],
  at: number,
  ctx: PickerKeyContext,
): void {
  event.preventDefault();
  const delta = event.key === 'PageDown' ? PICKER_PAGE_JUMP : -PICKER_PAGE_JUMP;
  const target = Math.min(items.length - 1, Math.max(0, Math.max(at, 0) + delta));
  activateItem(items[target]);
  if (delta > 0 && nearEnd(items.length, target)) ctx.loadMore();
}

/** Type-ahead: the next row (after the active one) whose label starts with the key. */
function typeAhead(
  event: KeyboardEvent<HTMLElement>,
  items: HTMLElement[],
  at: number,
  ctx: PickerKeyContext,
): void {
  if (ctx.searchable || !isTypeAheadKey(event)) return;
  const labels = items.map((item) => ctx.labelOf(item.getAttribute('data-value') ?? ''));
  const match = nextLabelMatch(labels, at, event.key);
  if (match >= 0) activateItem(items[match]);
}

/**
 * The keys cmdk leaves to the picker — cmdk owns ↑ ↓ (wrapping, skipping
 * disabled rows), Home / End and ↵. Tab closes the list; PgUp / PgDn move ±8
 * rows (clamped, enabled rows only); ↓, End and PgDn into the last 3 rows load
 * the next page; a letter jumps to the next row that starts with it when there
 * is no search row (H:3929–3939).
 */
export function handlePickerKey(
  event: KeyboardEvent<HTMLElement>,
  ctx: PickerKeyContext,
): void {
  if (event.nativeEvent.isComposing) return;
  if (event.key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();
    ctx.dismiss();
    return;
  }
  const items = enabledItems(ctx.list);
  const current = activeItem(ctx.list);
  const at = current ? items.indexOf(current) : -1;
  switch (event.key) {
    case 'PageDown':
    case 'PageUp':
      jumpRows(event, items, at, ctx);
      return;
    case 'ArrowDown':
    case 'End': {
      // cmdk moves the row; this only looks ahead for the next page.
      const next = event.key === 'End' ? items.length - 1 : (at + 1) % items.length;
      if (nearEnd(items.length, next)) ctx.loadMore();
      return;
    }
    default:
      typeAhead(event, items, at, ctx);
  }
}
