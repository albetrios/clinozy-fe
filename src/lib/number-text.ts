/*
 * The text of a typed number (H:3811): what may be typed, what it stands for in
 * the field's own unit, and what the field shows at rest — the items rows'
 * cells and the drawers' number fields alike. A money field types rupees and
 * stores integer paise (S:4).
 */

import { evaluateAmountExpression, isAmountExpression } from './amount-expression.ts';

/** Paise in a rupee — the scale of a money cell. */
export const MONEY_SCALE = 100;

/**
 * Rupees as clinozy-be sends them (a JSON number with two places) → whole paise, the unit the
 * money formatter and the number fields work in; rounded, so `0.1 + 0.2` rupees is 30 paise.
 */
export function paiseOfRupees(rupees: number): number {
  return Math.round(rupees * MONEY_SCALE);
}

/** Whole paise from a money field → rupees with two places, as clinozy-be takes them. */
export function rupeesOfPaise(paise: number): number {
  return Math.round(paise) / MONEY_SCALE;
}

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

/** `value` rounded to `places` decimals. */
const roundTo = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * The value typed text stands for, in the field's unit (`scale` × the figure):
 * '' is 0. Whole by default — money is whole paise — or kept to `places`
 * decimals of the unit (a 12.5 Disc %).
 */
export function numberFromText(text: string, scale: number, places = 0): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? roundTo(parsed * scale, places) : 0;
}

/**
 * What a number cell shows at rest: nothing for 0, so the placeholder ("0",
 * "₹ 0") reads instead; otherwise the plain figure, without grouping — to at
 * most `places` decimals when given (a back-solved 11.7232…% reads 11.72).
 */
export function textFromNumber(value: number, scale: number, places?: number): string {
  if (value === 0) return '';
  const figure = value / scale;
  return String(places === undefined ? figure : roundTo(figure, places));
}

/** A form value as a number: anything that is not a finite number counts as 0. */
export function cellNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** `value` kept between `min` and `max`. */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The characters a typed sum keeps: figures, operators, the shorthands' letters and spaces. */
const SUM_CHARACTERS = /[^\d.+\-*/xX×÷kKlLaAcChHsS ]/g;

/** The longest sum a field keeps as typed. */
const SUM_MAX_LENGTH = 40;

/** What a number field holds as typed: a plain figure, or a sum and what it comes to. */
export type TypedNumber =
  | { kind: 'figure'; text: string }
  | { kind: 'sum'; typed: string; result: number | null };

/**
 * Read what was typed into a number field (feat-write-less, D9): a plain figure is sanitized as
 * before ({@link sanitizeNumberText}); a sum or a shorthand (`1500+300`, `3x500`, `1.5k`, `2L`)
 * is kept as typed and comes to its result rounded to `decimals` — or `null` while it does not
 * work out (`12+`) or comes to less than zero.
 *
 * @param typed - The field's raw text.
 * @param decimals - Digits the field keeps after the point.
 * @returns The figure's text, or the sum as typed with its result.
 */
export function readTypedNumber(typed: string, decimals: number): TypedNumber {
  if (!isAmountExpression(typed)) {
    return { kind: 'figure', text: sanitizeNumberText(typed, decimals) };
  }
  const kept = typed.replace(SUM_CHARACTERS, '').slice(0, SUM_MAX_LENGTH);
  const value = evaluateAmountExpression(kept);
  const result = value === null || value < 0 ? null : roundTo(value, decimals);
  return { kind: 'sum', typed: kept, result };
}
