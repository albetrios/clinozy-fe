import { describe, expect, it } from 'vitest';

import {
  cellNumber,
  clampNumber,
  MONEY_SCALE,
  numberFromText,
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
