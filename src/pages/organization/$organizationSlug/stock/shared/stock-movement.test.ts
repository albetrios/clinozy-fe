import { describe, expect, it } from 'vitest';

import {
  contentsOf,
  exceedsStock,
  hasMeasure,
  movementDelta,
  quantityMilliOf,
  quantityStep,
  quickQuantities,
  startQuantity,
  stockAfter,
  TREATMENTS,
  treatmentTone,
} from './stock-movement.ts';

/** Soframycin: 3 tubes of 30 g. */
const TUBE = { qtyMilli: 3000, sizePerUnit: 30_000, measureUnit: 'g' as const };
/** Gauze: packs of 50 pcs. */
const PACK = { qtyMilli: 14_000, sizePerUnit: 50_000, measureUnit: 'pcs' as const };
/** Water: 1,000 ml bottles. */
const BOTTLE = { qtyMilli: 120_000, sizePerUnit: 1_000_000, measureUnit: 'ml' as const };
/** A kit of 10 ml. */
const KIT = { qtyMilli: 10_000, sizePerUnit: 10_000, measureUnit: 'ml' as const };
/** An item without contents. */
const PIECE = { qtyMilli: 2000, sizePerUnit: null, measureUnit: null };

describe('contents and the measure (`clinic-stock.md:91–93`)', () => {
  it('reads the contents of one unit, and whether the item can be counted in them', () => {
    expect(contentsOf(TUBE)).toBe(30);
    expect(contentsOf(PIECE)).toBeNull();
    expect(hasMeasure(TUBE)).toBe(true);
    expect(hasMeasure(PIECE)).toBe(false);
  });

  it('turns a typed quantity into units ×1000 — a figure in the measure is a share of a unit', () => {
    expect(quantityMilliOf('1', 'unit', TUBE)).toBe(1000);
    expect(quantityMilliOf('0.25', 'unit', TUBE)).toBe(250);
    expect(quantityMilliOf('30', 'measure', TUBE)).toBe(1000);
    expect(quantityMilliOf('15', 'measure', TUBE)).toBe(500);
    expect(quantityMilliOf('', 'measure', TUBE)).toBe(0);
    // Without contents the measure is the unit.
    expect(quantityMilliOf('2', 'measure', PIECE)).toBe(2000);
  });
});

describe('steps and quick chips (`clinic-stock.md:94–95, 131`)', () => {
  it('steps half a unit, or 10 / 5 / 1 in the measure by the contents', () => {
    expect(quantityStep('unit', TUBE)).toBe(0.5);
    expect(quantityStep('measure', BOTTLE)).toBe(10);
    expect(quantityStep('measure', TUBE)).toBe(5);
    expect(quantityStep('measure', KIT)).toBe(1);
    expect(quantityStep('measure', PIECE)).toBe(0.5);
  });

  it('offers 0.25 · 0.5 · 1 · 2 in units (the drawer adds 5), and 1 · 5 · 10 · 25 · 50 up to the contents', () => {
    expect(quickQuantities('unit', TUBE, 'popover')).toEqual([0.25, 0.5, 1, 2]);
    expect(quickQuantities('unit', TUBE, 'drawer')).toEqual([0.25, 0.5, 1, 2, 5]);
    expect(quickQuantities('measure', TUBE, 'popover')).toEqual([1, 5, 10, 25]);
    expect(quickQuantities('measure', PACK, 'drawer')).toEqual([1, 5, 10, 25, 50]);
    expect(quickQuantities('measure', KIT, 'popover')).toEqual([1, 5, 10]);
  });

  it('starts the measure at the contents up to 10, and units at 1', () => {
    expect(startQuantity('measure', TUBE)).toBe(10);
    expect(startQuantity('measure', { sizePerUnit: 5000 })).toBe(5);
    expect(startQuantity('unit', TUBE)).toBe(1);
    expect(startQuantity('measure', PIECE)).toBe(1);
  });
});

describe('the stock after a movement (`clinic-stock.md:97, 237`)', () => {
  it('adds a receipt, sets a count and takes out the rest — never below zero', () => {
    expect(stockAfter('received', TUBE, 1000)).toBe(4000);
    expect(stockAfter('adjust', TUBE, 2500)).toBe(2500);
    expect(stockAfter('used', TUBE, 1000)).toBe(2000);
    expect(stockAfter('damaged', TUBE, 5000)).toBe(0);
  });

  it('signs the change: out is negative, a count is the difference', () => {
    expect(movementDelta('used', TUBE, 1000)).toBe(-1000);
    expect(movementDelta('returned', TUBE, 500)).toBe(-500);
    expect(movementDelta('received', TUBE, 1000)).toBe(1000);
    expect(movementDelta('adjust', TUBE, 2500)).toBe(-500);
  });

  it('flags taking out more than the shelf holds — not a receipt or a count', () => {
    expect(exceedsStock('used', TUBE, 3500)).toBe(true);
    expect(exceedsStock('used', TUBE, 3000)).toBe(false);
    expect(exceedsStock('received', TUBE, 9000)).toBe(false);
    expect(exceedsStock('adjust', TUBE, 9000)).toBe(false);
  });
});

describe('"Used for" (`clinic-stock.md:96`)', () => {
  it('offers the five treatments, each in its name’s tone', () => {
    expect(TREATMENTS.map((treatment) => treatment.name)).toEqual([
      'LHR',
      'Peel',
      'Facial',
      'Mole removal',
      'General',
    ]);
    for (const treatment of TREATMENTS) {
      expect(treatmentTone(treatment)).toBe(treatmentTone({ ...treatment }));
    }
  });
});
