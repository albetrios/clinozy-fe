import type { KeyboardEvent } from 'react';

import { platformShortcutKeys, type ShortcutKeys } from '@/lib/apple-platform.ts';

/** Marks a drawer's footer primary — the button ⌘ / Ctrl Enter presses. */
export const DRAWER_PRIMARY_ATTRIBUTE = 'data-drawer-primary';

const SAVE_KEYS = {
  apple: { label: '⌘ ↵', aria: 'Meta+Enter' },
  other: { label: 'Ctrl ↵', aria: 'Control+Enter' },
} as const satisfies Record<'apple' | 'other', ShortcutKeys>;

/** This device's save keys: "⌘ ↵" (`Meta+Enter`) on Apple devices, "Ctrl ↵" (`Control+Enter`) elsewhere. */
export function saveShortcutKeys(): ShortcutKeys {
  return platformShortcutKeys(SAVE_KEYS);
}

/** ⌘ Enter or Ctrl Enter alone — not mid-composition, not already taken by a field inside. */
function isSaveShortcut(event: KeyboardEvent<HTMLElement>): boolean {
  return (
    event.key === 'Enter' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.defaultPrevented &&
    !event.nativeEvent.isComposing
  );
}

/**
 * ⌘ / Ctrl Enter anywhere in a record drawer presses its footer primary — a click, so a disabled
 * primary does nothing, an incomplete one names what is missing and a form drawer submits its
 * form. Keys from another surface (a stacked child drawer, a popover — portals the React tree
 * still bubbles through) and a drawer without a primary (read-only, no footer) are left alone.
 *
 * @remarks
 * Algorithm: the event's DOM target must sit inside `event.currentTarget` (the drawer's panel,
 * `role="dialog"`); the primary is the first `[data-drawer-primary]` whose own dialog is that
 * panel. Side effects: `preventDefault()` and a `click()` on the primary when one is pressed.
 *
 * @returns True when the primary was pressed.
 */
export function pressDrawerPrimary(event: KeyboardEvent<HTMLElement>): boolean {
  if (!isSaveShortcut(event)) return false;
  const panel = event.currentTarget;
  const target = event.target;
  const inside = target instanceof Node && panel.contains(target);
  if (!inside) return false;
  const primary = Array.from(
    panel.querySelectorAll<HTMLButtonElement>(`[${DRAWER_PRIMARY_ATTRIBUTE}]`),
  ).find((button) => button.closest('[role="dialog"]') === panel);
  if (!primary || primary.disabled) return false;
  event.preventDefault();
  primary.click();
  return true;
}
