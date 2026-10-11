import { numberFromText } from '@/lib/number-text.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { toneForLabel } from '@/shared/app/app-tones.ts';

import type { StockItemRecord } from './stock-contracts.ts';
import type { StockMovementInputType } from './stock-records-contracts.ts';
import { fromMilli, MILLI } from './stock-units.ts';

/*
 * The arithmetic the Use popover and the movement drawer share
 * (`clinic-stock.md:89–140`; H:5265, H:5286–5295): a quantity typed in the
 * item's unit or — for an item with contents — in its measure, the steps and
 * quick chips each offers, and the stock after the movement — a preview of
 * what the member is typing; the saved movement's balance is the server's
 * (`afterMilli`).
 */

/** What a typed quantity counts: the item's unit ("tube") or its measure ("g"). */
export type QuantityMode = 'unit' | 'measure';

/** Movements that take stock out (`IS_MT`, H:3727). */
const TAKES_OUT: ReadonlySet<StockMovementInputType> = new Set([
  'used',
  'damaged',
  'returned',
]);

/** The "Used for" chips (`clinic-stock.md:96`): the names stored, each in its label's tone. */
export const TREATMENTS = [
  { key: 'lhr', name: 'LHR' },
  { key: 'peel', name: 'Peel' },
  { key: 'facial', name: 'Facial' },
  { key: 'mole', name: 'Mole removal' },
  { key: 'general', name: 'General' },
] as const;

/** One "Used for" chip. */
type Treatment = (typeof TREATMENTS)[number];

/** A chip's tone — the prototype hashes its English name (H:5290). */
export const treatmentTone = (treatment: Treatment): Tone => toneForLabel(treatment.name);

/** An item's contents in its measure — 30 for a 30 g tube; `null` without them. */
export function contentsOf(item: Pick<StockItemRecord, 'sizePerUnit'>): number | null {
  return item.sizePerUnit ? fromMilli(item.sizePerUnit) : null;
}

/** Whether the item can be counted in its measure (it has contents). */
export const hasMeasure = (item: Pick<StockItemRecord, 'sizePerUnit' | 'measureUnit'>) =>
  Boolean(item.sizePerUnit && item.measureUnit);

/**
 * A typed quantity in the item's units ×1000: a figure in the measure is
 * divided by the contents — 30 g of a 30 g tube is one tube.
 */
export function quantityMilliOf(
  text: string,
  mode: QuantityMode,
  item: Pick<StockItemRecord, 'sizePerUnit'>,
): number {
  if (mode === 'measure' && item.sizePerUnit) {
    return Math.round(
      (Number.parseFloat(text || '0') * MILLI * MILLI) / item.sizePerUnit,
    );
  }
  return numberFromText(text, MILLI);
}

/**
 * The stepper's step (`clinic-stock.md:94`): half a unit, or in the measure
 * 10 with 100 or more contents, 5 with 20 or more, else 1.
 */
export function quantityStep(
  mode: QuantityMode,
  item: Pick<StockItemRecord, 'sizePerUnit'>,
): number {
  const contents = contentsOf(item);
  if (mode === 'unit' || contents === null) return 0.5;
  if (contents >= 100) return 10;
  return contents >= 20 ? 5 : 1;
}

/**
 * The quick chips (`clinic-stock.md:95, 131`): units 0.25 · 0.5 · 1 · 2 (the
 * drawer adds 5), or in the measure 1 · 5 · 10 · 25 · 50 up to the contents.
 */
export function quickQuantities(
  mode: QuantityMode,
  item: Pick<StockItemRecord, 'sizePerUnit'>,
  surface: 'popover' | 'drawer',
): number[] {
  const contents = contentsOf(item);
  if (mode === 'measure' && contents !== null) {
    return [1, 5, 10, 25, 50].filter((value) => value <= contents);
  }
  return surface === 'drawer' ? [0.25, 0.5, 1, 2, 5] : [0.25, 0.5, 1, 2];
}

/** Switching to the measure starts at min(contents, 10) (`clinic-stock.md:93`); back to units, 1. */
export function startQuantity(
  mode: QuantityMode,
  item: Pick<StockItemRecord, 'sizePerUnit'>,
): number {
  const contents = contentsOf(item);
  return mode === 'measure' && contents !== null ? Math.min(contents, 10) : 1;
}

/** The stock after a movement of `qtyMilli` (Adjust: the counted quantity), never below 0. */
export function stockAfter(
  type: StockMovementInputType,
  item: Pick<StockItemRecord, 'qtyMilli'>,
  qtyMilli: number,
): number {
  if (type === 'received') return item.qtyMilli + qtyMilli;
  if (type === 'adjust') return qtyMilli;
  return Math.max(0, item.qtyMilli - qtyMilli);
}

/** More is being taken out than the shelf holds ("Only 3 tube · 90 g in stock"). */
export const exceedsStock = (
  type: StockMovementInputType,
  item: Pick<StockItemRecord, 'qtyMilli'>,
  qtyMilli: number,
) => TAKES_OUT.has(type) && qtyMilli > item.qtyMilli;
