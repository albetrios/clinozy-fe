import { useSyncExternalStore } from 'react';

/** A touch screen's primary pointer cannot hover (the design's touch rule, H:221). */
const HOVER_NONE_QUERY = '(hover: none)';

function hoverNoneQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(HOVER_NONE_QUERY);
}

/** Whether the primary pointer can hover right now (`false` on a touch screen). */
export function readCanHover(): boolean {
  return !hoverNoneQuery()?.matches;
}

function subscribe(onChange: () => void): () => void {
  const query = hoverNoneQuery();
  if (!query) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Live `(hover: none)`, inverted: `true` with a mouse or trackpad, `false` on a
 * touch screen. For markup that changes with the input, not the width — person
 * cards open on hover with a pointer and on a tap on touch (KICKOFF §3.5); row
 * actions and checkboxes stay visible on touch. Layout tiers are
 * `useViewportTier`.
 */
export function useCanHover(): boolean {
  return useSyncExternalStore(subscribe, readCanHover, () => true);
}
