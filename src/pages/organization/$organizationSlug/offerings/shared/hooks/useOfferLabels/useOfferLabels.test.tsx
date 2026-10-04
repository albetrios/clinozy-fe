import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { useOfferLabels } from './useOfferLabels.ts';

afterEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-US' });
});

describe('useOfferLabels (H:5460)', () => {
  it('words each kind’s value, money in clinic rupees', () => {
    useLocaleStore.setState({ formatLocale: 'en-IN' });
    const { result } = renderHook(() => useOfferLabels());
    expect(result.current.value({ kind: 'percent', value: 20 })).toBe('20% off');
    expect(result.current.value({ kind: 'amount', value: 50_000 })).toBe('₹500 off');
    expect(result.current.value({ kind: 'fixed', value: 399_900 })).toBe('at ₹3,999');
    expect(result.current.value({ kind: 'extra', value: 1 })).toBe('+1 session');
    expect(result.current.value({ kind: 'extra', value: 2 })).toBe('+2 sessions');
  });

  it('names the kinds and the derived states in the clinic vocabulary', () => {
    const { result } = renderHook(() => useOfferLabels());
    expect(result.current.kind('fixed')).toBe('Fixed price');
    expect(result.current.kind('extra')).toBe('Extra sessions');
    expect(result.current.state('live')).toBe('Running');
    expect(result.current.state('ended')).toBe('Ended');
  });
});
