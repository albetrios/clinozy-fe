import { cn } from '@/lib/utils.ts';

/** The main column's widths a deployment can force (`VITE_LAYOUT_WIDTH`). */
export type LayoutWidthId = 'contained' | 'full' | 'reading';

/**
 * The launch's width — the one look was designed edge to edge for the clinic's
 * wide tables. No longer a per-user preference: the Appearance studio that set
 * it is retired.
 */
export const LAUNCH_LAYOUT_WIDTH: LayoutWidthId = 'full';

/** Effective layout width: the deployment's forced width, else the launch's. */
export function resolveEffectiveLayoutWidth(forced: LayoutWidthId | null): LayoutWidthId {
  return forced ?? LAUNCH_LAYOUT_WIDTH;
}

/** Tailwind classes for the inner wrapper inside `#main-content`. */
export function layoutMainClassName(width: LayoutWidthId): string {
  return cn(
    'w-full',
    // Keeps growing past `2xl`: capped at 1536px, the column covered well under
    // half of a 3440px ultrawide and no longer lined up with the header above it.
    width === 'contained' &&
      'mx-auto max-w-screen-2xl 3xl:max-w-[112rem] 4xl:max-w-[136rem]',
    width === 'reading' && 'mx-auto max-w-3xl',
  );
}
