import { prefersReducedMotion } from '@/lib/animations/prefers-reduced-motion.ts';
import { useScrollEdges } from '@/shared/hooks/useScrollEdges/index.ts';

/** How far a ‹ › press scrolls: 90% of the track (H:4389). */
const STEP = 0.9;

/** The carousel's scroll state and its ‹ › moves, mirrored under RTL. */
export interface FeedbackCarousel {
  trackRef: (node: HTMLDivElement | null) => (() => void) | undefined;
  canPrevious: boolean;
  canNext: boolean;
  previous: () => void;
  next: () => void;
}

/**
 * The Feedback carousel's track (H:4389): a horizontal snap row whose ‹ ›
 * show only while there is more that way (the shared `useScrollEdges`), and
 * scroll 90% of its width. Under RTL the browser's scroll offset runs negative
 * and "next" is leftwards.
 */
export function useFeedbackCarousel(): FeedbackCarousel {
  const track = useScrollEdges<HTMLDivElement>('x');

  const move = (direction: 1 | -1) => {
    const node = track.element();
    if (!node) return;
    const rtl = getComputedStyle(node).direction === 'rtl';
    node.scrollBy({
      left: node.clientWidth * STEP * direction * (rtl ? -1 : 1),
      // A scripted smooth scroll ignores the global reduce rule: it asks (feat-payment-celebration).
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  return {
    trackRef: track.attach,
    canPrevious: track.start,
    canNext: track.end,
    previous: () => move(-1),
    next: () => move(1),
  };
}
