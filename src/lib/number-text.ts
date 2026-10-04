/*
 * The text of a typed number (H:3811): what may be typed, what it stands for in
 * the field's own unit, and what the field shows at rest — the items rows'
 * cells and the drawers' number fields alike. A money field types rupees and
 * stores integer paise (S:4).
 */

/** Paise in a rupee — the scale of a money cell. */
export const MONEY_SCALE = 100;

/**
 * Keeps what a number cell can hold: digits and, when it takes `decimals`,
 * one point with at most that many digits after it. Anything else typed or
 * pasted ("₹", spaces, a second point) is dropped.
 */
export function sanitizeNumberText(text: string, decimals: number): string {
  const kept = text.replace(decimals > 0 ? /[^\d.]/g : /\D/g, '');
  const point = kept.indexOf('.');
  if (point === -1) return kept;
  const fraction = kept
    .slice(point + 1)
    .replace(/\./g, '')
    .slice(0, decimals);
  return `${kept.slice(0, point)}.${fraction}`;
}

/** The value typed text stands for, in the field's unit (`scale` × the figure, whole): '' is 0. */
export function numberFromText(text: string, scale: number): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Math.round(parsed * scale) : 0;
}

/**
 * What a number cell shows at rest: nothing for 0, so the placeholder ("0",
 * "₹ 0") reads instead; otherwise the plain figure, without grouping.
 */
export function textFromNumber(value: number, scale: number): string {
  return value === 0 ? '' : String(value / scale);
}

/** A form value as a number: anything that is not a finite number counts as 0. */
export function cellNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** `value` kept between `min` and `max`. */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
