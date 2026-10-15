import { useEffect, useEffectEvent } from 'react';

import { isEditableTarget } from '@/lib/editable-focus.ts';
import { insideOverlay } from '@/shared/components/DataTable/useTableSelection.ts';

/** What a key does on Today. */
export type TodayShortcut =
  'find' | 'previousLane' | 'nextLane' | 'newBooking' | 'walkIn';

/** The parts of a key press a shortcut reads. */
type ShortcutKey = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'defaultPrevented' | 'isComposing'
>;

/** Today's keys (D7): `/` find, `[` `]` the lanes, `N` New booking, `W` Walk-in. */
const TODAY_KEYS_TO_SHORTCUTS: Readonly<Record<string, TodayShortcut>> = {
  '/': 'find',
  '[': 'previousLane',
  ']': 'nextLane',
  n: 'newBooking',
  N: 'newBooking',
  w: 'walkIn',
  W: 'walkIn',
};

/** A dialog the page's keys must leave alone. */
const MODAL_SELECTOR = '[aria-modal="true"], [role="alertdialog"]';

/**
 * The shortcut a key press means on Today, or null: none with Ctrl, ⌘ or Alt (the app's own
 * ⌘K and ⌘/ keep theirs), none mid-composition (an IME), none already handled.
 */
export function todayShortcut(event: ShortcutKey): TodayShortcut | null {
  if (event.defaultPrevented || event.isComposing) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  return TODAY_KEYS_TO_SHORTCUTS[event.key] ?? null;
}

/** What each shortcut does — absent, the key does nothing (the member can't take it). */
export interface TodayShortcutHandlers {
  onFind: () => void;
  onLane: (step: -1 | 1) => void;
  onNewBooking?: () => void;
  onWalkIn?: () => void;
}

/**
 * Today's keys (change-today-command-center, BRIEF.md change 4; D7) on the document while the
 * page is mounted: `/` focuses the floor finder, `[` and `]` step through the lanes, `N` opens
 * New booking and `W` Walk-in. Never while typing in a field, inside an open menu, list or
 * dialog, or with a modifier — so `?`, `G`, the digits and ⌘K stay the app's.
 */
export function useTodayShortcuts(handlers: TodayShortcutHandlers): void {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (isEditableTarget(event.target) || insideOverlay(event.target)) return;
    if (document.querySelector(MODAL_SELECTOR)) return;
    const shortcut = todayShortcut(event);
    if (!shortcut) return;
    const run = {
      find: handlers.onFind,
      previousLane: () => handlers.onLane(-1),
      nextLane: () => handlers.onLane(1),
      newBooking: handlers.onNewBooking,
      walkIn: handlers.onWalkIn,
    }[shortcut];
    if (!run) return;
    event.preventDefault();
    run();
  });
  useEffect(() => {
    const down = (event: KeyboardEvent) => handle(event);
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
}
