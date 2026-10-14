import { describe, expect, it } from 'vitest';

import {
  cellNumber,
  clampNumber,
  MONEY_SCALE,
  numberFromText,
  paiseOfRupees,
  readTypedNumber,
  rupeesOfPaise,
  sanitizeNumberText,
  textFromNumber,
} from './number-text.ts';

describe('sanitizeNumberText — what a number cell takes (H:3811)', () => {
  it('keeps digits only for a whole number', () => {
    expect(sanitizeNumberText('1a2.5', 0)).toBe('125');
    expect(sanitizeNumberText('₹ 1,200', 0)).toBe('1200');
  });

  it('keeps one point and at most `decimals` digits after it', () => {
    expect(sanitizeNumberText('180.505', 2)).toBe('180.50');
    expect(sanitizeNumberText('1.2.3', 2)).toBe('1.23');
    expect(sanitizeNumberText('12.', 2)).toBe('12.');
    expect(sanitizeNumberText('.5', 2)).toBe('.5');
  });
});

describe('numberFromText — the value in the field’s own unit', () => {
  it('scales rupees to whole paise', () => {
    expect(numberFromText('180.5', MONEY_SCALE)).toBe(18_050);
    expect(numberFromText('0.29', MONEY_SCALE)).toBe(29);
    expect(numberFromText('1200', MONEY_SCALE)).toBe(120_000);
  });

  it('reads empty or a lone point as 0', () => {
    expect(numberFromText('', 1)).toBe(0);
    expect(numberFromText('.', MONEY_SCALE)).toBe(0);
  });

  it('keeps a plain number’s decimals to its places, whole by default', () => {
    expect(numberFromText('12.5', 1)).toBe(13);
    expect(numberFromText('12.5', 1, 2)).toBeCloseTo(12.5, 2);
    expect(numberFromText('12.345', 1, 2)).toBeCloseTo(12.35, 2);
  });
});

describe('textFromNumber — to its places', () => {
  it('shows at most the places given', () => {
    expect(textFromNumber(11.723163841807903, 1, 2)).toBe('11.72');
    expect(textFromNumber(10, 1, 2)).toBe('10');
    expect(textFromNumber(500_017, MONEY_SCALE, 2)).toBe('5000.17');
  });
});

describe('textFromNumber — the cell at rest', () => {
  it('is empty for 0, so the placeholder reads', () => {
    expect(textFromNumber(0, 1)).toBe('');
    expect(textFromNumber(0, MONEY_SCALE)).toBe('');
  });

  it('shows the plain figure, without grouping', () => {
    expect(textFromNumber(18_050, MONEY_SCALE)).toBe('180.5');
    expect(textFromNumber(120_000, MONEY_SCALE)).toBe('1200');
    expect(textFromNumber(15, 1)).toBe('15');
  });
});

describe('cellNumber and clampNumber', () => {
  it('reads anything but a finite number as 0', () => {
    expect(cellNumber(7)).toBe(7);
    expect(cellNumber('7')).toBe(0);
    expect(cellNumber(Number.NaN)).toBe(0);
    expect(cellNumber(undefined)).toBe(0);
  });

  it('holds a value between its bounds', () => {
    expect(clampNumber(0, 1, 999)).toBe(1);
    expect(clampNumber(1200, 1, 999)).toBe(999);
    expect(clampNumber(40, 1, 999)).toBe(40);
  });
});

describe('paiseOfRupees / rupeesOfPaise — clinozy-be’s rupees and the fields’ paise', () => {
  it('turns two-place rupees into whole paise, rounding the float', () => {
    expect(paiseOfRupees(4800.5)).toBe(480050);
    expect(paiseOfRupees(0.1 + 0.2)).toBe(30);
    expect(paiseOfRupees(-12.34)).toBe(-1234);
  });

  it('turns whole paise back into rupees with two places', () => {
    expect(rupeesOfPaise(480050)).toBeCloseTo(4800.5, 2);
    expect(rupeesOfPaise(30)).toBeCloseTo(0.3, 2);
    expect(rupeesOfPaise(1234.4)).toBeCloseTo(12.34, 2);
  });
});

describe('readTypedNumber — a figure, or a sum and its result (feat-write-less)', () => {
  it('sanitizes a plain figure as before', () => {
    expect(readTypedNumber('₹ 12,500.755', 2)).toEqual({
      kind: 'figure',
      text: '12500.75',
    });
    expect(readTypedNumber('abc', 2)).toEqual({ kind: 'figure', text: '' });
  });

  it('keeps a sum as typed and works it out to the field’s places', () => {
    expect(readTypedNumber('1500+300', 2)).toEqual({
      kind: 'sum',
      typed: '1500+300',
      result: 1800,
    });
    expect(readTypedNumber('1000/3', 2)).toMatchObject({ result: 333.33 });
    expect(readTypedNumber('1000/3', 0)).toMatchObject({ result: 333 });
    expect(readTypedNumber('1.5k', 0)).toMatchObject({ result: 1500 });
    expect(readTypedNumber('₹2 lakh', 2)).toMatchObject({
      typed: '2 lakh',
      result: 200_000,
    });
  });

  it('has no result while the sum is unfinished or below zero', () => {
    expect(readTypedNumber('1500+', 2)).toEqual({
      kind: 'sum',
      typed: '1500+',
      result: null,
    });
    expect(readTypedNumber('100-300', 2)).toMatchObject({ result: null });
  });
});
