/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SENTRY_DSN: string;
  /** Sentry traces sample rate (0..1) — set per environment. */
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE: string;
  /** Sentry session-replay sample rate (0..1) — set per environment. */
  readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: string;
  /** Sentry profiles sample rate (0..1). */
  readonly VITE_SENTRY_PROFILES_SAMPLE_RATE: string;
  /** Sentry replay-on-error sample rate (0..1). */
  readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: string;
  readonly VITE_POSTHOG_KEY: string;
  readonly VITE_POSTHOG_HOST: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_DEV_API_URL: string;
  readonly VITE_APP_BUILD_ID: string;
  readonly VITE_APP_VERSION: string;
  /** Injected from BUILD_I18N_MODE — `single` (default) or `multi`. */
  readonly VITE_I18N_BUILD_MODE: string;
  /** Injected from BUILD_I18N_LOCALE — BCP 47 tag (default en-US). */
  readonly VITE_I18N_BUILD_BCP47: string;
  readonly VITE_I18N_BUILD_UI_LOCALE: string;
  /** Optional: privacy-policy URL linked from the cookie-consent banner. */
  readonly VITE_PRIVACY_POLICY_URL: string;
  readonly VITE_DISABLED_MODULES: string;
  readonly VITE_AUTH_EMAIL: string;
  readonly VITE_AUTH_OAUTH_GOOGLE: string;
  readonly VITE_AUTH_OAUTH_GITHUB: string;
  readonly VITE_AUTH_OAUTH_APPLE: string;
  readonly VITE_AUTH_OAUTH_AUTO_GOOGLE: string;
  readonly VITE_AUTH_PASSKEY: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
  readonly VITE_CAPTCHA_DISABLED: string;
  /** Emit `[Module]` diagnostic console logs — off in production. */
  readonly VITE_DEBUG_LOGGING: string;
  /** Mount dev-only affordances (React Query Devtools, debug panels). */
  readonly VITE_DEVTOOLS: string;
  /** Install Playwright E2E hooks on `globalThis`. */
  readonly VITE_E2E_HOOKS: string;
  /** Poll `/version.json` for new deployments — on in deployed envs. */
  readonly VITE_VERSION_CHECK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __API_BASE_URL__: string;
