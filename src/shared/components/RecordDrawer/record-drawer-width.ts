/**
 * The record drawer's width rule (`_patterns.md:28`, H:3850): from `md` up the
 * panel is `min(W, 100vw − 56px)`; below `md` it is the full screen.
 */

/**
 * Widths a screen may ask for explicitly: the five `_patterns.md:28` lists and
 * New lead's 640 (`leads.md:21`, H:5853).
 */
export const EXPLICIT_DRAWER_WIDTHS = [600, 640, 720, 820, 900, 1040] as const;

/** A width a screen may pass instead of the automatic one. */
export type ExplicitDrawerWidth = (typeof EXPLICIT_DRAWER_WIDTHS)[number];

/** Every width W the drawer can take: the automatic three and the explicit six. */
export type RecordDrawerWidth = 560 | 680 | 840 | ExplicitDrawerWidth;

/** What the automatic width reads from the drawer's form. */
export interface DrawerContentProfile {
  /** How many fields the form shows, across every step. */
  fieldCount: number;
  /** A non-compact items field (an item-rows table) is present. */
  hasItems?: boolean;
  /**
   * A field that needs room: a textarea, an upload zone, the teeth chart, a
   * price or stock field, or a chip group of more than 5 options.
   */
  hasHeavyField?: boolean;
}

/** The light-form ceiling: at most this many fields, and none of them heavy. */
const LIGHT_FIELD_LIMIT = 8;
/** The width an items field forces; only a wider explicit width beats it. */
const ITEMS_WIDTH = 840;

/**
 * Picks W. An items field forces 840px (an explicit width wins only when it is
 * wider); otherwise an explicit width wins; otherwise a light form (≤ 8 fields,
 * none heavy) gets 560px and everything else 680px. Without a profile the
 * drawer takes the everyday 680px.
 */
export function resolveDrawerWidth(
  content: DrawerContentProfile | undefined,
  requested?: ExplicitDrawerWidth,
): RecordDrawerWidth {
  if (content?.hasItems) {
    return requested !== undefined && requested > ITEMS_WIDTH ? requested : ITEMS_WIDTH;
  }
  if (requested !== undefined) return requested;
  if (!content) return 680;
  return content.fieldCount <= LIGHT_FIELD_LIMIT && !content.hasHeavyField ? 560 : 680;
}

/** The viewport the drawer always leaves uncovered from `md` up (room for the ×). */
export const DRAWER_VIEWPORT_GUTTER = 56;

/** The rendered width at a viewport width (from `md` up): `min(W, vw − 56)`. */
export function drawerWidthAt(width: RecordDrawerWidth, viewportWidth: number): number {
  return Math.min(width, viewportWidth - DRAWER_VIEWPORT_GUTTER);
}

/**
 * The same rule as Tailwind classes — full literal strings, because Tailwind
 * only sees whole class names. Below `md` the panel is `w-full`.
 */
export const DRAWER_WIDTH_CLASS: Record<RecordDrawerWidth, string> = {
  560: 'md:w-[min(560px,calc(100vw-56px))]',
  600: 'md:w-[min(600px,calc(100vw-56px))]',
  640: 'md:w-[min(640px,calc(100vw-56px))]',
  680: 'md:w-[min(680px,calc(100vw-56px))]',
  720: 'md:w-[min(720px,calc(100vw-56px))]',
  820: 'md:w-[min(820px,calc(100vw-56px))]',
  840: 'md:w-[min(840px,calc(100vw-56px))]',
  900: 'md:w-[min(900px,calc(100vw-56px))]',
  1040: 'md:w-[min(1040px,calc(100vw-56px))]',
};
