import { platformConfig } from '@/core/config/env.ts';

/** True when a Stripe publishable key is configured for this deployment. */
export function isStripeEnabled(): boolean {
  const key = platformConfig.stripePublishableKey;
  return typeof key === 'string' && key.startsWith('pk_');
}

/** Lazily resolved publishable key — undefined when Stripe is not configured. */
export function getStripePublishableKey(): string | undefined {
  return isStripeEnabled() ? platformConfig.stripePublishableKey : undefined;
}
