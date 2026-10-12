import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadStripe, getStripePublishableKey } = vi.hoisted(() => ({
  loadStripe: vi.fn(),
  getStripePublishableKey: vi.fn(),
}));
vi.mock('@stripe/stripe-js', () => ({ loadStripe }));
vi.mock('@/shared/billing/stripe-config.ts', () => ({ getStripePublishableKey }));

/** A fresh module per test: the loader keeps its promise at module level. */
async function freshLoader() {
  vi.resetModules();
  return import('./load-stripe.ts');
}

beforeEach(() => {
  loadStripe.mockReset();
  getStripePublishableKey.mockReset();
});

describe('getStripePromise', () => {
  it('resolves to null and never loads Stripe.js without a publishable key', async () => {
    getStripePublishableKey.mockReturnValue(undefined);
    const { getStripePromise } = await freshLoader();

    await expect(getStripePromise()).resolves.toBeNull();
    expect(loadStripe).not.toHaveBeenCalled();
  });

  it('loads Stripe.js once with the publishable key and shares the promise', async () => {
    const stripe = { elements: vi.fn() };
    getStripePublishableKey.mockReturnValue('pk_test_123');
    loadStripe.mockResolvedValue(stripe);
    const { getStripePromise } = await freshLoader();

    const first = getStripePromise();
    const second = getStripePromise();

    expect(second).toBe(first);
    await expect(first).resolves.toBe(stripe);
    expect(loadStripe).toHaveBeenCalledOnce();
    expect(loadStripe).toHaveBeenCalledWith('pk_test_123');
  });
});
