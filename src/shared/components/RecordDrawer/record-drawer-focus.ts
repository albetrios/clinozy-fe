import { type RefObject, useRef } from 'react';

/**
 * Focus starts on the title (`_patterns.md:38`, §7.2) — or on what the screen
 * names instead — and goes back to whatever was focused when the drawer opened:
 * URL-driven drawers have no Radix trigger for the sheet to return to. The
 * record drawer and the drawers of its family (Day close) hand these to their
 * sheet.
 */
export function useDrawerTitleFocus(initialFocusRef?: RefObject<HTMLElement | null>) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return {
    titleRef,
    onOpenAutoFocus: (event: Event) => {
      const previous = document.activeElement;
      returnFocusRef.current = previous instanceof HTMLElement ? previous : null;
      event.preventDefault();
      (initialFocusRef?.current ?? titleRef.current)?.focus();
    },
    onCloseAutoFocus: (event: Event) => {
      const target = returnFocusRef.current;
      if (!target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}
