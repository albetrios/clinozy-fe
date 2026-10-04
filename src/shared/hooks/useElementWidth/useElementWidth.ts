import { useCallback, useState } from 'react';

/**
 * Measures an element's content width (`clientWidth`, so a scroller's
 * scrollbar is not counted) and follows it with a `ResizeObserver`. Returns a
 * callback ref to attach and the width in whole pixels — 0 until measured.
 * `axis: 'height'` measures `clientHeight` instead (the Month board's cells,
 * which fit as many chips as their height holds).
 *
 * Changes of `tolerance` px or less are ignored, so a scrollbar appearing or a
 * sub-pixel reflow does not re-plan a layout (the table's fold engine re-plans
 * past 4px, H:4095).
 */
export function useElementWidth<T extends Element>(
  tolerance = 4,
  axis: 'width' | 'height' = 'width',
): readonly [(node: T | null) => (() => void) | undefined, number] {
  const [size, setSize] = useState(0);

  const ref = useCallback(
    (node: T | null) => {
      if (!node) return undefined;
      const measure = () => {
        const next = Math.round(axis === 'width' ? node.clientWidth : node.clientHeight);
        setSize((previous) =>
          Math.abs(next - previous) > tolerance || (next === 0) !== (previous === 0)
            ? next
            : previous,
        );
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return undefined;
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    },
    [tolerance, axis],
  );

  return [ref, size] as const;
}
