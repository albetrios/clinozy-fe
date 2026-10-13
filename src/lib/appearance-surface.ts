import { cn } from '@/lib/utils.ts';

/**
 * The Appearance drawer's selectable tiles in the launch's language — named
 * radius steps, so the mode tiles and the language rows track the corner-radius
 * scale.
 */

/** Large selectable tile (mode cards, language rows): the settings card's frame. */
export const appearanceTileClassName =
  'bg-card relative rounded-xl border text-start transition-[background-color,border-color,box-shadow] duration-150 outline-none focus-visible:outline-hidden';

/** The picked tile: the ink edge a picked chip carries (`preset.md:64`). */
export const appearanceTileActiveClassName = 'border-foreground ring-foreground ring-1';
export const appearanceTileIdleClassName = 'border-border hover:bg-canvas';

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
