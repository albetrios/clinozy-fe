/**
 * Shared layout class strings for free responsive CSS grids.
 * Prefer these over fixed `grid-cols-{n}` when tiles should reflow fluidly.
 */

/** Equal-width tiles — quick actions, chip rows promoted to grid. */
export const autoFitActionsGrid =
  'grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]';

/** Card galleries — org pickers, stat tiles, settings groups. */
export const autoFitCardsGrid =
  'grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]';

/** Wide panels — highlight + sidebar, table + calendar (2:1). */
export const splitMainAsideGrid =
  'grid grid-cols-1 gap-3 lg:items-start lg:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]';

/** Dashboard KPI row — four equal tiles that reflow 2×2 then 4-across. */
export const dashboardKpiGrid =
  'grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]';

/** Theme strip + secondary panel on xl. */
export const dashboardFooterGrid =
  'grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start xl:gap-4';

/** Prevent grid blowout on nested tables/charts. */
export const gridCellMinWidth = 'min-w-0';
