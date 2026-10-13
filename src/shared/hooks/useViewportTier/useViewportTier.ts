import { useSyncExternalStore } from 'react';

/** The clinic screens' three layout tiers (KICKOFF D23). */
export type ViewportTier = 'phone' | 'tablet' | 'desktop';

/** Tailwind's `md` and `xl` — the boundaries the stylesheet switches at too. */
const TABLET_QUERY = '(min-width: 48rem)';
const DESKTOP_QUERY = '(min-width: 80rem)';

function tierQueries(): readonly [MediaQueryList, MediaQueryList] | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
}

/** The tier right now: phone below `md`, tablet `md`–below `xl`, desktop from `xl`. */
export function readViewportTier(): ViewportTier {
  const queries = tierQueries();
  if (!queries) return 'desktop';
  const [tablet, desktop] = queries;
  if (desktop.matches) return 'desktop';
  return tablet.matches ? 'tablet' : 'phone';
}

function subscribe(onChange: () => void): () => void {
  const queries = tierQueries();
  if (!queries) return () => {};
  for (const query of queries) query.addEventListener('change', onChange);
  return () => {
    for (const query of queries) query.removeEventListener('change', onChange);
  };
}

/**
 * The live layout tier. Layout itself switches with Tailwind tiers (`md:`,
 * `xl:`) — reach for this only where the MARKUP changes with the tier: a
 * popover that becomes a bottom sheet, the tooltip that is never shown on a
 * phone, the lead drawer's panes, Week view.
 */
export function useViewportTier(): ViewportTier {
  return useSyncExternalStore(subscribe, readViewportTier, () => 'desktop');
}
