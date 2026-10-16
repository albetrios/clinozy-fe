import { prefersReducedMotion } from '@/lib/animations/prefers-reduced-motion.ts';

/** The nearest ancestor that scrolls vertically; null when the page itself scrolls. */
function scrollerOf(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node && node !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Bring a section that has just opened into its scroller's view (the
 * prototype's `accReveal`, H:4016 — Offering suggestions and Feedback): on the
 * next frame, when it runs past the visible box, scroll just enough to show
 * its end with `margin` to spare — or, when it is taller than the box, its
 * top, `margin` down. A section already in view stays put.
 */
export function revealInScroller(element: HTMLElement | null, margin = 12): void {
  if (!element) return;
  requestAnimationFrame(() => {
    const scroller = scrollerOf(element);
    if (!scroller) return;
    const box = element.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    if (box.top >= view.top && box.bottom <= view.bottom) return;
    const top = box.top - view.top + scroller.scrollTop - margin;
    const end = scroller.scrollTop + (box.bottom - view.bottom) + margin;
    scroller.scrollTo({
      top: box.height > view.height ? top : Math.min(top, end),
      // A scripted smooth scroll ignores the global reduce rule: it asks (feat-payment-celebration).
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  });
}
