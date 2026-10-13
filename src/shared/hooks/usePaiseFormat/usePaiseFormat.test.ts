import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { usePaiseFormat } from './usePaiseFormat.ts';

const format = () => renderHook(() => usePaiseFormat()).result.current;

describe('usePaiseFormat', () => {
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

  it('prints whole rupees with the Indian grouping, from integer paise', () => {
    expect(format()(12345600)).toBe('₹1,23,456');
    expect(format()(0)).toBe('₹0');
  });

  it('shows paise only when there are some', () => {
    expect(format()(12345650)).toBe('₹1,23,456.50');
  });

  it('marks a negative amount with U+2212, never a hyphen', () => {
    expect(format()(-120000)).toBe('−₹1,200');
    expect(format()(-120000)).not.toContain('-');
  });

  it('is always rupees, whatever currency the Appearance preview uses', () => {
    // currencyCode is the Appearance sample currency; clinic money is INR.
    expect(format()(9900)).toBe('₹99');
  });

  it('follows the format locale and currency display preferences', () => {
    useLocaleStore.setState({ formatLocale: 'en-US' });
    expect(format()(12345600)).toBe('₹123,456');

    useLocaleStore.setState({ formatLocale: 'en-IN', currencyDisplay: 'code' });
    expect(format()(9900)).toMatch(/^INR\s99$/);
  });

  it('prints a dash for a value that is not a number', () => {
    expect(format()(Number.NaN)).toBe('—');
  });
});
