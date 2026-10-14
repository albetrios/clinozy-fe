import { useEffect } from 'react';

import { prefersReducedMotion } from './prefers-reduced-motion.ts';

/** The in-place skeleton's marker (`src/index.css`, "The in-place skeleton"). */
const REFRESHING_ATTRIBUTE = 'data-refreshing';

/**
 * The settle: from half opacity to full over 220ms, on the strong ease-out
 * (`--ease-out-strong` in `src/index.css`; the fallback is the same curve, for
 * a document that has not loaded the stylesheet). Half, not zero: the content
 * was on screen as bars a moment ago, so a fade from nothing would blink.
 */
export const REFRESH_SETTLE = {
  from: 0.5,
  duration: 220,
  fallbackEasing: 'cubic-bezier(0.23, 1, 0.32, 1)',
} as const;

/** The strong ease-out as the stylesheet defines it — Web Animations cannot read `var()`. */
function settleEasing(): string {
  const declared = getComputedStyle(document.documentElement)
    .getPropertyValue('--ease-out-strong')
    .trim();
  return declared === '' ? REFRESH_SETTLE.fallbackEasing : declared;
}

/**
 * Settles one subtree the in-place skeleton just left: its fresh content comes
 * up from half opacity instead of snapping from bars to text. Opacity only, on
 * the element itself (one animation, however many rows); nothing where Web
 * Animations are missing.
 */
export function settleRefreshed(element: Element): void {
  if (typeof element.animate !== 'function') return;
  element.animate([{ opacity: REFRESH_SETTLE.from }, { opacity: 1 }], {
    duration: REFRESH_SETTLE.duration,
    easing: settleEasing(),
  });
}

/**
 * Refreshes settle (change-motion-polish D11): one observer for the whole
 * document watches `data-refreshing` — the rooms' in-place skeleton, set by
 * tables, calendars, Today's floor and work queue and the task lists — and
 * when it LEAVES an element, settles that element in ({@link settleRefreshed}).
 * The places that set the attribute change nothing, and the first-paint CSS
 * gains nothing. Under reduced motion it does nothing: the content lands at
 * once, as the app's reduce rule lands everything else. Mounted once, by the
 * signed-in shell — the only place the skeleton is drawn.
 */
export function useRefreshSettle(): void {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver((records) => {
      if (prefersReducedMotion()) return;
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
