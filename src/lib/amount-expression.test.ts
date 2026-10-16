import { describe, expect, it } from 'vitest';

import { evaluateAmountExpression, isAmountExpression } from './amount-expression.ts';

describe('evaluateAmountExpression', () => {
  it.each([
    ['1500+300', 1800],
    ['2000-150', 1850],
    ['3x500', 1500],
    ['3*500', 1500],
    ['3×500', 1500],
    ['4500/3', 1500],
    ['1000+2x250', 1500],
    ['10-2-3', 5],
    ['1.5k', 1500],
    ['2L', 200_000],
    ['2 lakh', 200_000],
    ['1.25 lac', 125_000],
    ['3 lakhs', 300_000],
    ['1k+500', 1500],
    ['₹ 12,500 + 2,500', 15_000],
    ['.5k', 500],
    ['750', 750],
  ])('%s → %d', (text, expected) => {
    expect(evaluateAmountExpression(text)).toBe(expected);
  });

  it.each([
    ['12+'],
    ['+12'],
    ['-150'],
    ['12++3'],
    ['12/0'],
    ['2m'],
    ['abc'],
    [''],
    ['1.2.3'],
  ])('%s does not work out', (text) => {
    expect(evaluateAmountExpression(text)).toBeNull();
  });

  it('lets a result fall below zero for the field to refuse', () => {
    expect(evaluateAmountExpression('100-300')).toBe(-200);
  });
});

describe('isAmountExpression', () => {
  it('tells a sum or a shorthand from a plain figure', () => {
    expect(isAmountExpression('1500+300')).toBe(true);
    expect(isAmountExpression('1.5k')).toBe(true);
    expect(isAmountExpression('2L')).toBe(true);
    expect(isAmountExpression('₹ 12,500')).toBe(false);
    expect(isAmountExpression('12.5')).toBe(false);
    expect(isAmountExpression('abc')).toBe(false);
    expect(isAmountExpression('2m')).toBe(false);
  });
});
