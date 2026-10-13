import { useSyncExternalStore } from 'react';

/** How long a resize settles before the width is read again (H:4522). */
export const VIEWPORT_RESIZE_SETTLE_MS = 120;

/** The window's width in CSS px (the layout viewport, scrollbar included — what `100vw` is). */
function readViewportWidth(): number {
  return typeof window === 'undefined' ? 1440 : window.innerWidth;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, VIEWPORT_RESIZE_SETTLE_MS);
  };
  window.addEventListener('resize', settle);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('resize', settle);
  };
}

/**
 * The viewport's width, re-read 120ms after a resize settles (the prototype's
 * re-measure, H:4522) — for a layout whose widths are arithmetic on `vw`, like
 * the appointment form's form + chat rule and the lead drawer's two panes.
 * Layout that only switches at a tier
 * uses Tailwind (`md:`, `xl:`) or `useViewportTier` instead.
 */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, readViewportWidth, () => 1440);
}
