import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { useRupeeFormat } from './useRupeeFormat.ts';

const format = () => renderHook(() => useRupeeFormat()).result.current;

describe('useRupeeFormat', () => {
  beforeEach(() => {
    useLocaleStore.setState({
      formatLocale: 'en-IN',
      currencyDisplay: 'auto',
      currencyCode: 'USD',
    });
  });

  afterEach(() => {
    useLocaleStore.setState({
      formatLocale: 'en-US',
      currencyDisplay: 'auto',
      currencyCode: 'USD',
    });
  });

  it('prints the API’s rupees as the paise formatter prints the same amount', () => {
    expect(format()(123456)).toBe('₹1,23,456');
    expect(format()(4800.5)).toBe('₹4,800.50');
    expect(format()(0)).toBe('₹0');
  });

  it('rounds a two-place float to the paisa', () => {
    expect(format()(0.1 + 0.2)).toBe('₹0.30');
  });

  it('marks a negative with U+2212 and prints a dash for a value that is not a number', () => {
    expect(format()(-250)).toBe('−₹250');
    expect(format()(Number.NaN)).toBe('—');
  });
});
