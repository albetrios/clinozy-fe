import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  markSamePageNavigation,
  takeSamePageNavigation,
} from './same-page-navigation.ts';

describe('same-page navigation (feat-payment-celebration D13)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is taken once after a mark', () => {
    markSamePageNavigation();
    expect(takeSamePageNavigation()).toBe(true);
    expect(takeSamePageNavigation()).toBe(false);
  });

  it('runs out when no page commits within the pending policy’s 3s', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(10_000);
    markSamePageNavigation();
    now.mockReturnValue(13_500);
    expect(takeSamePageNavigation()).toBe(false);
  });
});
