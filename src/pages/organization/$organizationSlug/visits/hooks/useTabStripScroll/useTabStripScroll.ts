import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Which ends of a sideways tab strip hide more tabs. */
export interface TabStripEdges {
  /** Tabs wait before the inline start. */
  start: boolean;
  /** Tabs wait past the inline end. */
  end: boolean;
}

const NO_EDGES: TabStripEdges = { start: false, end: false };

/** The edge hint's width: a tab revealed this far inside the strip clears it. */
const EDGE_HINT_PX = 24;

/**
 * A tab strip that scrolls sideways (the Visit sheet's on a phone, KICKOFF
 * §6.13, D29): which ends hide more tabs — for the edge hints — and the open
 * tab kept in view whenever it changes, so a deep link to Checkout opens with
 * Checkout showing. The scroll offset is read as a distance from the start,
 * so a right-to-left strip (negative `scrollLeft`) reads the same; revealing
 * moves the strip alone, never the page around it. Each tab carries its value
 * as `data-tab`. Returns a callback ref for the scroller (the tablist) and its
 * edges.
 */
export function useTabStripScroll(
  selected: string,
): readonly [(node: HTMLElement | null) => (() => void) | undefined, TabStripEdges] {
  const [edges, setEdges] = useState<TabStripEdges>(NO_EDGES);
  const strip = useRef<HTMLElement | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    strip.current = node;
    if (!node) return undefined;
    const measure = () => {
      const offset = Math.abs(node.scrollLeft);
      const hidden = node.scrollWidth - node.clientWidth;
      const start = offset > 1;
      const end = hidden - offset > 1;
      setEdges((previous) =>
        previous.start === start && previous.end === end ? previous : { start, end },
      );
    };
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    // The tabs widen when the web font arrives: watch them, not only the strip.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    for (const tab of Array.from(node.children)) observer?.observe(tab);
    return () => {
      strip.current = null;
      node.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, []);

  // Before paint: a deep link never shows the strip at its start first.
  useLayoutEffect(() => {
    const node = strip.current;
    if (!node) return;
    const tab = Array.from(node.querySelectorAll<HTMLElement>('[data-tab]')).find(
      (candidate) => candidate.dataset.tab === selected,
    );
    if (!tab) return;
    const box = node.getBoundingClientRect();
    const rect = tab.getBoundingClientRect();
    // `scrollLeft` grows rightwards in either direction: a delta works for both.
    if (rect.left < box.left + EDGE_HINT_PX) {
      node.scrollLeft -= box.left + EDGE_HINT_PX - rect.left;
    } else if (rect.right > box.right - EDGE_HINT_PX) {
      node.scrollLeft += rect.right - (box.right - EDGE_HINT_PX);
    }
  }, [selected]);

  return [ref, edges] as const;
}
