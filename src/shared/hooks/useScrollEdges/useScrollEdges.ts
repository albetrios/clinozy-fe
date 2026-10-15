import { useCallback, useEffect, useRef, useState } from 'react';

/** The axis a {@link useScrollEdges} scroller moves along: sideways or down. */
export type ScrollAxis = 'x' | 'y';

/** A scroller's edges, and what to attach it with. */
export interface ScrollEdges<T extends HTMLElement> {
  /** The scroller's callback ref (`ref={edges.attach}`): it measures, listens to scroll and follows resizes. */
  attach: (node: T | null) => (() => void) | undefined;
  /** The scroller once attached, for a handler that moves it (a carousel's ‹ ›) — never read while rendering. */
  element: () => T | null;
  /** There is more before: above, or at the reading start (the right under RTL). */
  start: boolean;
  /** There is more after: below, or at the reading end. */
  end: boolean;
}

const NO_EDGES = { start: false, end: false } as const;

/** Half a pixel either way is a sub-pixel reflow, not more to scroll to. */
const SLACK = 1;

/**
 * Whether a scroller has more to show before and after what is in view — the fades and arrows
 * that say "there is more this way" (the contact picker's Recent rail and results window, the
 * patient file's Feedback carousel). Measured after every render (rows added or removed change
 * what there is to scroll to), on every scroll (its own passive listener) and on resize (a
 * `ResizeObserver`); it only sets state when an edge flips.
 *
 * @remarks
 * Under RTL the browser's sideways offset runs negative from 0, so `x` reads its magnitude: the
 * start is still the reading start.
 */
export function useScrollEdges<T extends HTMLElement = HTMLDivElement>(
  axis: ScrollAxis,
): ScrollEdges<T> {
  const nodeRef = useRef<T | null>(null);
  const [edges, setEdges] = useState<{ start: boolean; end: boolean }>(NO_EDGES);

  const measure = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;
    const travelled = Math.abs(axis === 'x' ? node.scrollLeft : node.scrollTop);
    const room =
      axis === 'x'
        ? node.scrollWidth - node.clientWidth
        : node.scrollHeight - node.clientHeight;
    const next = { start: travelled > SLACK, end: room - travelled > SLACK };
    setEdges((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
  }, [axis]);

  const attach = useCallback(
    (node: T | null) => {
      nodeRef.current = node;
      if (!node) return undefined;
      measure();
      node.addEventListener('scroll', measure, { passive: true });
      const observer =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
      observer?.observe(node);
      return () => {
        node.removeEventListener('scroll', measure);
        observer?.disconnect();
        if (nodeRef.current === node) nodeRef.current = null;
      };
    },
    [measure],
  );

  useEffect(() => {
    measure();
  });

  const element = useCallback(() => nodeRef.current, []);

  return { attach, element, ...edges };
}
