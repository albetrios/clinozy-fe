/**
 * Folding a row of tabs into "More" when they do not fit — the one algorithm
 * behind the header's pinned rooms (H:4087–4093) and a room toolbar's tab
 * track (H:4003–4007). Pure: the caller measures, this decides.
 */

/** Which tabs show and which fold into "More", as indices in tab order. */
export interface TabFit {
  visible: number[];
  folded: number[];
}

/** The geometry a tab row folds by. */
export interface TabFitOptions {
  /** The space "More" keeps once tabs fold. */
  reserve: number;
  /** Space between two tabs (default 0 — the widths already carry it). */
  gap?: number;
  /** The row's own inline padding and borders (default 0). */
  padding?: number;
}

/**
 * Fold `widths` into `available` space. All fit → all show. Otherwise "More"
 * keeps its reserve, the current tab stays, then tabs are kept in order until
 * the first one that does not fit; the rest fold. Until the row has been
 * measured (`available` null) nothing folds.
 */
export function fitTabs(
  widths: readonly number[],
  available: number | null,
  currentIndex: number,
  { reserve, gap = 0, padding = 0 }: TabFitOptions,
): TabFit {
  const all = widths.map((_, index) => index);
  if (available === null || widths.length === 0) return { visible: all, folded: [] };
  const total =
    padding + widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  if (total <= available) return { visible: all, folded: [] };

  let budget = available - padding - reserve;
  const kept = new Set<number>();
  const current = widths[currentIndex];
  if (current !== undefined) {
    kept.add(currentIndex);
    budget -= current;
  }
  for (const [index, width] of widths.entries()) {
    if (index === currentIndex) continue;
    if (width + gap > budget) break;
    kept.add(index);
    budget -= width + gap;
  }
  const folded = all.filter((index) => !kept.has(index));
  if (folded.length === 0) return { visible: all, folded: [] };
  return { visible: all.filter((index) => kept.has(index)), folded };
}

let measureContext: CanvasRenderingContext2D | null | undefined;

/**
 * A label's rendered width at a CSS `font` ("600 13px Inter"), measured on one
 * shared canvas the way the prototype measures its tabs (H:3996). Without a
 * canvas (tests, very old engines) it estimates 7.5px a character.
 */
export function measureTextWidth(text: string, font: string): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === 'undefined'
        ? null
        : (document.createElement('canvas').getContext('2d') ?? null);
  }
  if (!measureContext) return text.length * 7.5;
  measureContext.font = font;
  return measureContext.measureText(text).width;
}
