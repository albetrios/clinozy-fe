/** The form's own width, as the drawer had it alone. */
const RX_FORM_WIDTH = 1040;

/** The sidekick column's width from `xl` (feat-prescription-composer D7), and its narrowest. */
const RX_SIDEKICK_WIDTH = 320;
const RX_SIDEKICK_MIN_WIDTH = 272;

/** The widest the drawer grows with its column: the form keeps the 1040 it had alone. */
const RX_COMPOSER_MAX_WIDTH = RX_FORM_WIDTH + RX_SIDEKICK_WIDTH;

/** What the drawer always leaves of the viewport: room for the floating ×. */
const VIEWPORT_GUTTER = 56;

/**
 * The Rx drawer and its sidekick column from `xl` (feat-prescription-composer D7):
 * the drawer `min(1360, 100vw − 56)`, the column taking what the form leaves past
 * 1040 — 320 from 1416px, never under 272 (the form keeps 952 at 1280).
 */
export function rxComposerColumns(viewportWidth: number): {
  panel: number;
  aside: number;
} {
  const panel = Math.min(RX_COMPOSER_MAX_WIDTH, viewportWidth - VIEWPORT_GUTTER);
  const aside = Math.max(
    RX_SIDEKICK_MIN_WIDTH,
    Math.min(RX_SIDEKICK_WIDTH, panel - RX_FORM_WIDTH),
  );
  return { panel, aside };
}
