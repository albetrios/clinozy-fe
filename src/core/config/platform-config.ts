import type { I18nBuildMode } from '@/lib/i18n/build-config.ts';
import { buildEnv } from '@/lib/i18n/build-env.ts';

import type { OAuthProviderFlags } from './env-resolvers.ts';
import {
  resolveAuthMethodFlag,
  resolveBooleanFlag,
  resolveDeploymentOverride,
  resolveDisabledModules,
  resolveLayoutWidthForced,
  resolveOAuthProviderFlags,
  resolveSampleRate,
  resolveThemeLock,
} from './env-resolvers.ts';

/** Which auth methods this deployment exposes on the unified auth screen. */
export interface AuthMethods {
  email: boolean;
  oauth: OAuthProviderFlags;
  passkey: boolean;
  /** When true with Google OAuth on, `/login` auto-starts Google OAuth in the background. */
  oauthAutoGoogle: boolean;
}

/** Optional env overrides for deployment org kinds (null = defer to me/context). */
export interface DeploymentEnvOverrides {
  personalOrganizations: boolean | null;
  teamOrganizations: boolean | null;
}

export interface PlatformConfig {
  apiBaseUrl: string;
  sentryDsn: string | undefined;
  /** Sentry traces sample rate (0..1), env-driven per environment. */
  sentryTracesSampleRate: number;
  /** Sentry session-replay sample rate (0..1), env-driven per environment. */
  sentryReplaysSessionSampleRate: number;
  /** Sentry profiles sample rate (0..1), env-driven (default 1). */
  sentryProfilesSampleRate: number;
  /** Sentry replay-on-error sample rate (0..1), env-driven (default 1). */
  sentryReplaysOnErrorSampleRate: number;
  posthogKey: string | undefined;
  posthogHost: string | undefined;
  privacyPolicyUrl: string | undefined;
  layoutWidthForced: ReturnType<typeof resolveLayoutWidthForced>;
  themeLock: boolean;
  disabledModules: ReadonlySet<string>;
  authMethods: AuthMethods;
  captchaDisabled: boolean;
  turnstileSiteKey: string | undefined;
  stripePublishableKey: string | undefined;
  /** Emit `[Module]` diagnostic console logs (off in production; on locally). */
  debugLogging: boolean;
  /** Mount dev-only affordances — React Query Devtools, debug panels, theme shuffle. */
  devtools: boolean;
  /** Install Playwright E2E hooks (`navigateInApp`, `establishSession`) on `globalThis`. */
  e2eHooks: boolean;
  /** Poll `/version.json` for new deployments (on in deployed envs; off locally/tests). */
  versionCheckEnabled: boolean;
  /** True under the Vitest runner (`VITE_TEST_MODE`); the home for test-only behavior. */
  testMode: boolean;
  deploymentOverrides: DeploymentEnvOverrides;
  buildI18nMode: I18nBuildMode;
  buildI18nLocale: string;
  appBuildId: string | undefined;
  appVersion: string | undefined;
  /** Reported deployment name (Sentry/PostHog tag). Never branch on this. */
  environment: string;
}

export type ConfigGet = (key: string) => string | undefined;

type ClientEnvSlice = {
  VITE_APP_ENV: string;
};

/** Build typed platform config from resolved env getters. */
export function resolvePlatformConfig(
  get: ConfigGet,
  clientEnv: ClientEnvSlice,
): PlatformConfig {
  const oauth = resolveOAuthProviderFlags(get);
  const oauthAutoGoogleRaw = resolveAuthMethodFlag(get('AUTH_OAUTH_AUTO_GOOGLE'), false);

  // Purely env-driven — no build-mode branch. Local dev sets VITE_API_BASE_URL=''
  // (relative, so the Vite proxy handles `/api`); deploys set the absolute origin.
  // Strip trailing slash(es) so joining `${base}/api/...` never yields a double
  // slash (e.g. `https://api.example.com//api/v1/...`), which some proxies/CORS
  // setups 404 or reject on preflight. Done with a loop (not a regex) to avoid
  // the sonarjs super-linear-regex rule and to handle repeated slashes.
  let apiBaseUrl = get('API_BASE_URL') ?? '';
  while (apiBaseUrl.endsWith('/')) apiBaseUrl = apiBaseUrl.slice(0, -1);

  return {
    apiBaseUrl,

    sentryDsn: get('SENTRY_DSN'),
    sentryTracesSampleRate: resolveSampleRate(get('SENTRY_TRACES_SAMPLE_RATE'), 0.1),
    sentryReplaysSessionSampleRate: resolveSampleRate(
      get('SENTRY_REPLAYS_SESSION_SAMPLE_RATE'),
      0.1,
    ),
    sentryProfilesSampleRate: resolveSampleRate(get('SENTRY_PROFILES_SAMPLE_RATE'), 1),
    sentryReplaysOnErrorSampleRate: resolveSampleRate(
      get('SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE'),
      1,
    ),
    posthogKey: get('POSTHOG_KEY'),
    posthogHost: get('POSTHOG_HOST'),
    privacyPolicyUrl: get('PRIVACY_POLICY_URL'),
    layoutWidthForced: resolveLayoutWidthForced(get('LAYOUT_WIDTH')),
    themeLock: resolveThemeLock(get('THEME_LOCK')),
    disabledModules: resolveDisabledModules(get('DISABLED_MODULES')),

    authMethods: {
      email: resolveAuthMethodFlag(get('AUTH_EMAIL'), true),
      oauth,
      passkey: resolveAuthMethodFlag(get('AUTH_PASSKEY'), true),
      oauthAutoGoogle: oauthAutoGoogleRaw && oauth.google,
    },

    captchaDisabled: get('CAPTCHA_DISABLED') === 'true',
    turnstileSiteKey: get('TURNSTILE_SITE_KEY'),
    stripePublishableKey: get('STRIPE_PUBLISHABLE_KEY'),

    debugLogging: resolveBooleanFlag(get('DEBUG_LOGGING'), false),
    devtools: resolveBooleanFlag(get('DEVTOOLS'), false),
    e2eHooks: resolveBooleanFlag(get('E2E_HOOKS'), false),
    versionCheckEnabled: resolveBooleanFlag(get('VERSION_CHECK'), true),
    testMode: resolveBooleanFlag(get('TEST_MODE'), false),

    deploymentOverrides: {
      personalOrganizations: resolveDeploymentOverride(get('PERSONAL_ORGANIZATIONS')),
      teamOrganizations: resolveDeploymentOverride(get('TEAM_ORGANIZATIONS')),
    },

    buildI18nMode: buildEnv.i18nMode,
    buildI18nLocale: buildEnv.i18nBcp47,
    appBuildId: buildEnv.appBuildId,
    appVersion: buildEnv.appVersion,

    environment: clientEnv.VITE_APP_ENV,
  };
}

/** Resolved auth-method toggles for `/login`. */
export function resolveAuthMethodsFromPlatform(platform: PlatformConfig): AuthMethods {
  return platform.authMethods;
}

/** Whether a feature module is enabled for this deployment. */
export function isPlatformModuleEnabled(
  platform: PlatformConfig,
  moduleKey: string,
): boolean {
  return !platform.disabledModules.has(moduleKey);
}
