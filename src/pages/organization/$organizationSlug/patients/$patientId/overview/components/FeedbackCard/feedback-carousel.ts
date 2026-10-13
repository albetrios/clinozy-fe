import { useCallback, useEffect, useRef, useState } from 'react';

/** How far a ‹ › press scrolls: 90% of the track (H:4389). */
const STEP = 0.9;

/** The carousel's scroll state and its ‹ › moves, mirrored under RTL. */
export interface FeedbackCarousel {
  trackRef: (node: HTMLDivElement | null) => void;
  canPrevious: boolean;
  canNext: boolean;
  previous: () => void;
  next: () => void;
  onScroll: () => void;
}

/**
 * The Feedback carousel's track (H:4389): a horizontal snap row whose ‹ ›
 * show only while there is more that way, and scroll 90% of its width. Under
 * RTL the browser's scroll offset runs negative and "next" is leftwards.
 */
export function useFeedbackCarousel(): FeedbackCarousel {
  const track = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ canPrevious: false, canNext: false });

  const measure = useCallback(() => {
    const node = track.current;
    if (!node) return;
    const travelled = Math.abs(node.scrollLeft);
    const room = node.scrollWidth - node.clientWidth;
    const next = { canPrevious: travelled > 1, canNext: room - travelled > 1 };
    setEdges((current) =>
      current.canPrevious === next.canPrevious && current.canNext === next.canNext
        ? current
        : next,
    );
  }, []);

  const trackRef = useCallback(
    (node: HTMLDivElement | null) => {
      track.current = node;
      measure();
    },
    [measure],
  );

  // Cards loaded, removed or filtered change what there is to scroll to:
  // measure after every render (it only sets state when an edge flips).
  useEffect(() => {
    measure();
  });

  useEffect(() => {
    const node = track.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const move = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    const rtl = getComputedStyle(node).direction === 'rtl';
    node.scrollBy({
      left: node.clientWidth * STEP * direction * (rtl ? -1 : 1),
      behavior: 'smooth',
    });
  };

  return {
    trackRef,
    ...edges,
    previous: () => move(-1),
    next: () => move(1),
    onScroll: measure,
  };
}
