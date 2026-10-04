import { useEffect, useEffectEvent } from 'react';

import { isEditableTarget } from '@/lib/editable-focus.ts';

/**
 * Esc goes back when nothing is open (KICKOFF §6.6 Keyboard; Q-F8): the
 * top-most surface takes Esc first — a viewer, a drawer, a popover, a menu,
 * a table's selection, each marking the key handled (Radix layers do it in the
 * capture phase) — and only an Esc nobody handled, pressed outside a text
 * field, runs `onBack`. It listens on `window`, after every `document`
 * listener has had its turn.
 */
export function useEscapeBack(onBack: () => void): void {
  const back = useEffectEvent(onBack);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      back();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
