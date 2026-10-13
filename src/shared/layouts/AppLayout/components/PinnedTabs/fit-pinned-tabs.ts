import { fitTabs, type TabFit } from '@/lib/fit-tabs.ts';

/** Space "More" keeps once pins fold (H:4089). */
export const MORE_RESERVE = 84;

/** The search field's share of the header when pins compete with it (H:4084). */
const SEARCH_RESERVE = 170;

/**
 * The width one pinned tab needs: inline padding 20, icon 16, gap 6, the label
 * at 600 13px, plus 2 (H:4074).
 */
export function pinnedTabWidth(labelWidth: number): number {
  return Math.ceil(20 + 16 + 6 + labelWidth) + 2;
}

/** The header pieces the tab budget is measured against (H:4084–4085). */
export interface HeaderMeasure {
  /** The header's width inside its inline padding. */
  innerWidth: number;
  /** The brand mark (slot 1). */
  markWidth: number;
  /** The All sections wrapper (slot 3). */
  allSectionsWidth: number;
  /** Every right-cluster item except the search: divider, branch picker, avatar. */
  rightItemWidths: readonly number[];
  /** Whether the right cluster starts with the search field. */
  hasSearch: boolean;
}

/**
 * What the pinned tabs may use: the header's inner width less 20, the mark,
 * 4, the All sections wrapper + 6, each other right-cluster item + 6, and the
 * 170px the search keeps (H:4084–4085).
 */
export function availableTabSpace(measure: HeaderMeasure): number {
  const rest =
    measure.rightItemWidths.reduce((sum, width) => sum + width + 6, 0) +
    (measure.hasSearch ? SEARCH_RESERVE : 0);
  return Math.floor(
    measure.innerWidth -
      20 -
      measure.markWidth -
      4 -
      (measure.allSectionsWidth + 6) -
      rest,
  );
}

/**
 * Fold the pins into the space measured (H:4087–4093) — {@link fitTabs} with
 * the header's 84px "More" reserve; each pin's width already carries its gap.
 */
export function fitPinnedTabs(
  widths: readonly number[],
  available: number | null,
  currentIndex: number,
): TabFit {
  return fitTabs(widths, available, currentIndex, { reserve: MORE_RESERVE });
}
