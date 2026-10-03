import type { MouseEvent as ReactMouseEvent } from 'react';

const ITEM_SELECTOR = '[cmdk-item]';
const ENABLED_ITEM_SELECTOR = '[cmdk-item]:not([aria-disabled="true"])';

/** Marks the panel's scroll container (rows scroll inside it, never the page). */
const PICKER_SCROLL_ATTRIBUTE = 'data-picker-scroll';

/** Keeps focus in the search field (or the list) when a row is pressed. */
export function keepFocus(event: ReactMouseEvent) {
  event.preventDefault();
}

/** The list's enabled rows, in order (the create row included). */
export function enabledItems(list: HTMLElement | null): HTMLElement[] {
  return list
    ? Array.from(list.querySelectorAll<HTMLElement>(ENABLED_ITEM_SELECTOR))
    : [];
}

/** The active row — cmdk marks it `aria-selected`. */
export function activeItem(list: HTMLElement | null): HTMLElement | null {
  return (
    list?.querySelector<HTMLElement>(`${ITEM_SELECTOR}[aria-selected="true"]`) ?? null
  );
}

/** The enabled row whose cmdk value is `value`. */
export function itemByValue(
  list: HTMLElement | null,
  value: string,
): HTMLElement | undefined {
  return enabledItems(list).find((item) => item.getAttribute('data-value') === value);
}

/**
 * Scroll the panel (only the panel — the popover is fixed, so the page must
 * not move) until `item` is fully in view.
 */
export function revealItem(item: HTMLElement): void {
  const scroller = item.closest<HTMLElement>(`[${PICKER_SCROLL_ATTRIBUTE}]`);
  if (!scroller) return;
  const top = item.offsetTop;
  const bottom = top + item.offsetHeight;
  if (top < scroller.scrollTop) {
    scroller.scrollTop = top;
  } else if (bottom > scroller.scrollTop + scroller.clientHeight) {
    scroller.scrollTop = bottom - scroller.clientHeight;
  }
}

/**
 * Make `item` the active row and bring it into view. cmdk has no imperative
 * "activate": its pointer path is the only one that also moves
 * `aria-activedescendant`, so a synthetic `pointermove` drives it.
 */
export function activateItem(item: HTMLElement | undefined): void {
  if (!item) return;
  const EventType = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  item.dispatchEvent(new EventType('pointermove', { bubbles: true }));
  revealItem(item);
}
