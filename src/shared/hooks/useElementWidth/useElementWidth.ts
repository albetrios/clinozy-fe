import { useCallback, useState } from 'react';

/**
 * Measures an element's content width (`clientWidth`, so a scroller's
 * scrollbar is not counted) and follows it with a `ResizeObserver`. Returns a
 * callback ref to attach and the width in whole pixels — 0 until measured.
 *
 * Changes of `tolerance` px or less are ignored, so a scrollbar appearing or a
 * sub-pixel reflow does not re-plan a layout (the table's fold engine re-plans
 * past 4px, H:4095).
 */
export function useElementWidth<T extends Element>(
  tolerance = 4,
): readonly [(node: T | null) => (() => void) | undefined, number] {
  const [width, setWidth] = useState(0);

  const ref = useCallback(
    (node: T | null) => {
      if (!node) return undefined;
      const measure = () => {
        const next = Math.round(node.clientWidth);
        setWidth((previous) =>
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
    [tolerance],
  );

  return [ref, width] as const;
}
