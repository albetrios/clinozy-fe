import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { usePrintFormat, usePrintTranslation } from './print-format.ts';

describe('usePrintFormat — the sheets’ numbers, money and dates', () => {
  beforeEach(() => {
    useLocaleStore.getState().setFormatLocale('en-IN');
  });
  afterEach(() => {
    useLocaleStore.getState().setFormatLocale('en-US');
  });

  it('writes paise as rupees with two places, rounding a fraction of a paisa', () => {
    const { result } = renderHook(() => usePrintFormat('INR'));
    expect(result.current.money(141_600)).toBe('₹1,416.00');
    expect(result.current.money(0)).toBe('₹0.00');
    expect(result.current.money(1_999.6)).toBe('₹20.00');
    expect(result.current.amount(12_000)).toBe('120.00');
    expect(result.current.amount(5)).toBe('0.05');
  });

  it('never turns a bill’s figures compact, whatever the viewer’s number preference', () => {
    const { result } = renderHook(() => usePrintFormat('INR'));
    expect(result.current.money(1_20_00_000)).toBe('₹1,20,000.00');
    expect(result.current.amount(1_20_00_000)).toBe('1,20,000.00');
    expect(result.current.count(120_000)).toBe('1,20,000');
  });

  it('writes a whole percentage with two places', () => {
    const { result } = renderHook(() => usePrintFormat());
    expect(result.current.percent(18)).toBe('18.00%');
    expect(result.current.percent(0)).toBe('0.00%');
    expect(result.current.percent(12.5)).toBe('12.50%');
  });

  it('writes a calendar day numerically, on its own day', () => {
    const { result } = renderHook(() => usePrintFormat());
    expect(result.current.date('2026-09-24')).toBe('24/09/2026');
    expect(result.current.date('2026-01-01')).toBe('01/01/2026');
  });

  it('keeps one format while nothing changes', () => {
    const { result, rerender } = renderHook(({ currency }) => usePrintFormat(currency), {
      initialProps: { currency: 'INR' },
    });
    const first = result.current;
    rerender({ currency: 'INR' });
    expect(result.current).toBe(first);
    rerender({ currency: 'USD' });
    expect(result.current).not.toBe(first);
  });
});

describe('usePrintTranslation', () => {
  it('reads the sheets’ copy in the print language, not the screen’s', () => {
    const { result } = renderHook(() => usePrintTranslation());
    expect(result.current.i18n).toBeDefined();
    expect(typeof result.current.t).toBe('function');
  });
});
