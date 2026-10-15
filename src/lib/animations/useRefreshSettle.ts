import { useEffect } from 'react';

import { cssCurve } from './motion-curves.ts';
import { prefersReducedMotion } from './prefers-reduced-motion.ts';

/** The in-place skeleton's marker (`src/index.css`, "The in-place skeleton"). */
const REFRESHING_ATTRIBUTE = 'data-refreshing';

/**
 * The settle: from half opacity to full on the strong ease-out — 200ms, or
 * 160ms under reduced motion, where it stays because it is opacity only
 * (reduced motion is gentler, not zero). Half, not zero: the content was on
 * screen as bars a moment ago, so a fade from nothing would blink.
 */
export const REFRESH_SETTLE = {
  from: 0.5,
  duration: 200,
  reducedDuration: 160,
  easing: cssCurve('outStrong'),
} as const;

/**
 * Settles one subtree the in-place skeleton just left: its fresh content comes
 * up from half opacity instead of snapping from bars to text. Opacity only, on
 * the element itself (one animation, however many rows); nothing where Web
 * Animations are missing.
 */
export function settleRefreshed(element: Element): void {
  if (typeof element.animate !== 'function') return;
  element.animate([{ opacity: REFRESH_SETTLE.from }, { opacity: 1 }], {
    duration: prefersReducedMotion()
      ? REFRESH_SETTLE.reducedDuration
      : REFRESH_SETTLE.duration,
    easing: REFRESH_SETTLE.easing,
  });
}

/**
 * Refreshes settle (change-motion-polish D11): one observer for the whole
 * document watches `data-refreshing` — the rooms' in-place skeleton, set by
 * tables, calendars, Today's floor and work queue and the task lists — and
 * when it LEAVES an element, settles that element in ({@link settleRefreshed}).
 * The places that set the attribute change nothing, and the first-paint CSS
 * gains nothing. Mounted once, by the signed-in shell — the only place the
 * skeleton is drawn.
 */
export function useRefreshSettle(): void {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver((records) => {
      const settled = new Set<Element>();
      for (const record of records) {
        const element = record.target;
        if (
          element instanceof Element &&
          record.oldValue !== null &&
          !element.hasAttribute(REFRESHING_ATTRIBUTE) &&
          !settled.has(element)
        ) {
          settled.add(element);
          settleRefreshed(element);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: [REFRESHING_ATTRIBUTE],
      attributeOldValue: true,
    });
    return () => observer.disconnect();
  }, []);
}
