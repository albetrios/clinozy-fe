import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/config/env.ts', () => ({
  platformConfig: { stripePublishableKey: 'pk_test_123' },
}));

import { getStripePublishableKey, isStripeEnabled } from './stripe-config.ts';

describe('stripe-config', () => {
  it('is enabled when a publishable key is configured', () => {
    expect(isStripeEnabled()).toBe(true);
    expect(getStripePublishableKey()).toBe('pk_test_123');
  });
});
