import type { Page } from '@playwright/test';

/** The sign-in methods the running app resolved from its env (`platformConfig.authMethods`). */
export interface AppSignInMethods {
  google: boolean;
  github: boolean;
}

/**
 * Reads the sign-in methods the running app actually resolved — the same
 * `platformConfig.authMethods.oauth` `AuthForm` renders from — by importing the config module from
 * the Vite dev server inside the page (the same module instance the app uses). A spec asserts what
 * this deployment is configured to offer, so `VITE_AUTH_OAUTH_GOOGLE=false` in `.env.local` is a
 * different expectation, not a failure.
 *
 * @remarks
 * Needs the dev server (`pnpm dev` or the suite's own `webServer`), which serves `/src/*` modules;
 * against a built preview it throws instead of guessing.
 */
export async function readAppSignInMethods(page: Page): Promise<AppSignInMethods> {
  return page.evaluate(async () => {
    const configModule = '/src/core/config/env.ts';
    const { platformConfig } = (await import(/* @vite-ignore */ configModule)) as {
      platformConfig: { authMethods: { oauth: { google: boolean; github: boolean } } };
    };
    const { google, github } = platformConfig.authMethods.oauth;
    return { google, github };
  });
}

/**
 * Whether the running app has Stripe — the same `isStripeEnabled()` (a `pk_` publishable key in
 * `VITE_STRIPE_PUBLISHABLE_KEY`) the billing panel decides on before it shows a subscription's
 * invoices and payment methods. Imported from the Vite dev server inside the page, like
 * {@link readAppSignInMethods}, so a spec asserts what this build offers.
 */
export async function readAppStripeEnabled(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const stripeModule = '/src/shared/billing/stripe-config.ts';
    const { isStripeEnabled } = (await import(/* @vite-ignore */ stripeModule)) as {
      isStripeEnabled: () => boolean;
    };
    return isStripeEnabled();
  });
}
