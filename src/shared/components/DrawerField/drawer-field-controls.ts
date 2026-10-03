/**
 * Control sizes for drawer fields (`_patterns.md:34`) — the same on a phone.
 * Screens pass them to the shared primitives' `className`.
 */

/** Text input: 36px, `rounded-lg`, 13.5px, 10px sides. */
export const DRAWER_INPUT_CLASS = 'h-9 rounded-lg px-2.5 text-field md:text-field';

/**
 * Textarea: 9px 10px, 13.5px / 1.45, resizes vertically and keeps its `rows`
 * (the stock textarea grows with its content instead).
 */
export const DRAWER_TEXTAREA_CLASS =
  'field-sizing-fixed min-h-0 resize-y rounded-lg px-2.5 py-2.25 text-field leading-[1.45] md:text-field';

/** The id a drawer field gives its error message, for the control's `aria-describedby`. */
export function drawerFieldErrorId(controlId: string): string {
  return `${controlId}-error`;
}
