/**
 * Per-organization brand accent (FE-57). When the active org carries a
 * `brandColor`, override the `--color-brand` design token at the document root
 * so `bg-brand` / `text-brand` reflect it; clear it (revert to the theme
 * default) otherwise. Gracefully no-ops until the backend provides `brand_color`
 * — the engine is wired and ready.
 */
export function applyOrgBrand(brandColor: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (brandColor) {
    root.style.setProperty('--color-brand', brandColor);
  } else {
    root.style.removeProperty('--color-brand');
  }
}
