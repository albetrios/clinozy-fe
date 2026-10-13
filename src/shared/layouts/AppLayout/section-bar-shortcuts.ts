import { useEffect, useEffectEvent } from 'react';

import { isEditableTarget } from '@/lib/editable-focus.ts';
import { insideOverlay } from '@/shared/components/DataTable/useTableSelection.ts';

/** What a key press asks of the section bar: toggle All sections, or open the n-th room. */
export type SectionShortcut = { kind: 'toggle' } | { kind: 'open'; index: number };

/** The parts of a key press the shortcuts read. */
type ShortcutKey = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'defaultPrevented'
>;

/** A modal surface is up — the command menu, a confirm, a dialog still loading. */
const MODAL_SELECTOR = '[aria-modal="true"], [role="alertdialog"]';

/**
 * Marks the section bar's own surfaces — the All sections popover and sheet.
 * A key pressed inside them is still the bar's: G closes them, a number opens
 * a room.
 */
const OWN_SURFACE_SELECTOR = '[data-sections-surface]';

/**
 * The section bar's single-key shortcuts (KICKOFF §3.2 and §6.0; `shell.md:46`;
 * H:3165): G toggles All sections; 1–9 then 0 open the 1st–10th room of the
 * visible list. Not with ⌘, Ctrl or Alt held, and not once another handler has
 * taken the key. `null` when the key is not one of them, or names a room the
 * list does not have.
 */
export function sectionShortcut(
  event: ShortcutKey,
  roomCount: number,
): SectionShortcut | null {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }
  if (event.key === 'g' || event.key === 'G') return { kind: 'toggle' };
  if (/^\d$/.test(event.key)) {
    const index = (Number(event.key) + 9) % 10;
    return index < roomCount ? { kind: 'open', index } : null;
  }
  return null;
}

/**
 * Whether a key press belongs to something else: typing in a field, a modal
 * surface being up, or a key that went to an open surface — a drawer, dialog,
 * menu or list, as "/" and j / k read it (`insideOverlay`) — other than the
 * bar's own All sections.
 */
function belongsElsewhere(event: KeyboardEvent): boolean {
  const { target } = event;
  if (isEditableTarget(target) || document.querySelector(MODAL_SELECTOR)) return true;
  const own = target instanceof Element && target.closest(OWN_SURFACE_SELECTOR) !== null;
  return insideOverlay(target) && !own;
}

/**
 * Listens for {@link sectionShortcut} on the document while the shell is
 * mounted — outside text fields only (as designed), and never under a modal
 * surface or from inside an open drawer, dialog, menu or list, so a room
 * switch cannot slip out from under an open drawer and its draft.
 */
export function useSectionShortcuts({
  roomCount,
  onToggle,
  onOpen,
}: {
  roomCount: number;
  onToggle: () => void;
  onOpen: (index: number) => void;
}) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (belongsElsewhere(event)) return;
    const shortcut = sectionShortcut(event, roomCount);
    if (!shortcut) return;
    event.preventDefault();
    if (shortcut.kind === 'toggle') onToggle();
    else onOpen(shortcut.index);
  });
  useEffect(() => {
    const down = (event: KeyboardEvent) => handle(event);
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
}
