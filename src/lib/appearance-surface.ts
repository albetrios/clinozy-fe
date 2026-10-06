import { cn } from '@/lib/utils.ts';

/**
 * Appearance-studio surfaces in the launch's language — named radius steps, so
 * mode tiles, language rows and option pills track the active corner-radius
 * axis.
 */

/** Large selectable tile (mode cards, language rows): the settings card's frame. */
export const appearanceTileClassName =
  'bg-card relative rounded-xl border text-start transition-[background-color,border-color,box-shadow] duration-150 outline-none focus-visible:outline-hidden';

/** The picked tile: the ink edge a picked chip carries (`preset.md:64`). */
export const appearanceTileActiveClassName = 'border-foreground ring-foreground ring-1';
export const appearanceTileIdleClassName = 'border-border hover:bg-canvas';

/**
 * Compact option pill (presets, formats, axis choices): the Account menu's
 * Appearance radio pill (`shell.md:27`) — 28px, 12px/500, a hairline. The
 * element adds `rounded-full` beside its `data-slot="pill"`, so the Sharp shape
 * can square it.
 */
export const appearanceChoiceClassName =
  'inline-flex h-7 items-center gap-1.5 border px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:outline-hidden';

/** The picked pill: `muted` with the disabled-step edge, as the menu's radio pills. */
export const appearanceChoiceActiveClassName = 'bg-muted border-disabled text-foreground';
export const appearanceChoiceIdleClassName =
  'border-border text-foreground-soft hover:bg-muted hover:text-foreground';

/** Mode card — column layout on a step card's padding. */
export const appearanceModeCardClassName = cn(
  appearanceTileClassName,
  'flex flex-col items-start gap-2 p-(--step-pad)',
);

/** Language / compact row tile. */
export const appearanceRowTileClassName = cn(
  appearanceTileClassName,
  'text-body flex items-center justify-between gap-2 px-3 py-2.5',
);

/** Preview / icon sample well, on the canvas. */
export const appearancePreviewWellClassName =
  'bg-canvas flex items-center justify-center gap-4 rounded-lg border border-dashed px-4 py-3';
