/**
 * Allowlist guard for CSS *values* that get interpolated into a raw `<style>`
 * tag (e.g. chart theme colors → CSS custom properties). Permits the characters
 * that legitimate color tokens use — hex, `rgb()/hsl()/oklch()/var()`, named
 * colors, numbers, percentages — and rejects anything that could terminate a
 * declaration or the style block (`; { } < > : " '`), which is the CSS/HTML
 * injection vector.
 */
const SAFE_CSS_VALUE = /^[#0-9a-zA-Z().,%/\s-]+$/;

/** True if `value` is a safe CSS color/value token to interpolate into `<style>`. */
export function isSafeCssColor(value: string): boolean {
  return value.length > 0 && value.length <= 128 && SAFE_CSS_VALUE.test(value);
}
