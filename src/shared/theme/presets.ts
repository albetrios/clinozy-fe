/**
 * The app's one look — the launch's Clinozy Zinc Pastel — and how it reaches
 * `<html>`.
 *
 * The look is the `[data-theme='clinozy-zinc-pastel']` blocks in
 * `src/index.css` over the base `@theme` tokens, composed with `.dark` for the
 * mode. There is nothing to pick any more (the design has no theme studio):
 * the named presets, the generated looks and their seeds, and the per-axis
 * catalogs are retired, and every axis renders at the launch's default.
 * `public/theme-init.js` sets the same attribute before first paint.
 *
 * Product-design floors for the look: docs/reference/preset-product-design-rules.md
 */

/** The one look: its `data-theme` id (`src/index.css`, `public/theme-init.js`). */
export const THEME_ID = 'clinozy-zinc-pastel';

/**
 * Put the look on `<html>`. `theme-init.js` already did before first paint;
 * the theme store re-asserts it when it rehydrates.
 */
export function applyTheme(): void {
  document.documentElement.dataset.theme = THEME_ID;
}

/**
 * How many AuthLayout designs exist (TEMP — see AuthLayout variants): the
 * launch's canvas (0, the default) and three earlier previews.
 */
const AUTH_VARIANT_COUNT = 4;

/**
 * TEMP (auth-layout preview): a different design index in 0..N-1. Remove
 * together with the `authVariant` store field + the AuthLayout variants.
 */
export function nextAuthVariant(current: number): number {
  // eslint-disable-next-line sonarjs/pseudo-random -- cosmetic layout preview, not security
  const v = Math.floor(Math.random() * AUTH_VARIANT_COUNT);
  return v === current ? (v + 1) % AUTH_VARIANT_COUNT : v;
}

/**
 * How many PublicLayout shells exist (TEMP — see PublicLayout variants): the
 * launch's canvas (0, the default) and three earlier previews.
 */
const PUBLIC_VARIANT_COUNT = 4;

/**
 * TEMP (public-layout preview): a different shell index in 0..N-1. Remove together
 * with the `publicVariant` store field + the PublicLayout variants.
 */
export function nextPublicVariant(current: number): number {
  // eslint-disable-next-line sonarjs/pseudo-random -- cosmetic layout preview, not security
  const v = Math.floor(Math.random() * PUBLIC_VARIANT_COUNT);
  return v === current ? (v + 1) % PUBLIC_VARIANT_COUNT : v;
}

/**
 * TEMP layout-preview switches — whether a shuffle may roll each layout preview.
 * Nothing rolls a preview any more (the shuffle retired, 2026-10), so nothing
 * reads these at runtime; they stay OFF as the record that the launch's canvases
 * are live. Delete the whole block with the previews.
 */
export const SHUFFLE_TEMP = {
  /**
   * Cycle the AuthLayout (login screen) preview design on shuffle.
   *
   * OFF since L-65: the default (variant 0) is the launch's sign-in canvas, and
   * a shuffle may not rotate it away (docs/design-workflow/process/adoption.md,
   * "Making a variant live"). Structural, not cosmetic: each auth shell owns
   * the form, so rolling it mid-sign-in would remount the email step and drop a
   * code the user is typing.
   */
  authLayout: false,
  /**
   * Cycle the PublicLayout preview design on shuffle. OFF since L-65: the
   * default (variant 0) is the launch's signed-out canvas, pinned like the auth
   * one — the onboarding wizard lives in this layout.
   */
  publicLayout: false,
};
