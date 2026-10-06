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
