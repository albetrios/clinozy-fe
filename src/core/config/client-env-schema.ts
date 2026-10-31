/**
 * The client's env contract — the `import.meta.env` subset validated at app boot, and the
 * cross-field auth invariants checked there. The ONLY env-schema module the app imports
 * (`env.config.ts`), so the entry chunk carries client keys alone: the deploy, build and
 * local-tooling keys, their descriptions and the per-environment profiles live in the
 * tooling-only {@link env-schema.ts} (F-8). `env-schema.test.ts` pins every `VITE_` key of
 * `envSchemaBase` to this schema.
 */
import { z } from 'zod';

import {
  hasAnyAuthSurface,
  resolveBooleanFlag,
  resolveOAuthProviderFlags,
} from './env-resolvers.ts';

/** Client `import.meta.env` subset validated at app boot. */
export const clientEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().optional(),
  VITE_DEV_API_URL: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z.string().optional(),
  VITE_SENTRY_PROFILES_SAMPLE_RATE: z.string().optional(),
  VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: z.string().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),
  VITE_POSTHOG_HOST: z.string().optional(),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  VITE_LAYOUT_WIDTH: z.enum(['contained', 'full', 'reading']).optional(),
  VITE_THEME_LOCK: z.string().optional(),
  VITE_PRIVACY_POLICY_URL: z.string().optional(),
  VITE_CSP_REPORT_URI: z.string().optional(),
  VITE_DISABLED_MODULES: z.string().optional(),
  VITE_PERSONAL_ORGANIZATIONS: z.string().optional(),
  VITE_TEAM_ORGANIZATIONS: z.string().optional(),
  VITE_AUTH_EMAIL: z.string().optional(),
  VITE_AUTH_OAUTH_GOOGLE: z.string().optional(),
  VITE_AUTH_OAUTH_GITHUB: z.string().optional(),
  VITE_AUTH_OAUTH_APPLE: z.string().optional(),
  VITE_AUTH_OAUTH_AUTO_GOOGLE: z.string().optional(),
  VITE_AUTH_PASSKEY: z.string().optional(),
  VITE_CAPTCHA_DISABLED: z.string().optional(),
  VITE_TURNSTILE_SITE_KEY: z.string().optional(),
  VITE_DEBUG_LOGGING: z.string().optional(),
  VITE_DEVTOOLS: z.string().optional(),
  VITE_E2E_HOOKS: z.string().optional(),
  VITE_VERSION_CHECK: z.string().optional(),
  // Test-runner flag (test.env-injected by plugins/test-env.ts, never in a .env file
  // or committed to .env.example). `"true"` marks the Vitest run — the single home for
  // test-only behavior. Read via `platformConfig.testMode`; never mode-sniffed in app code.
  VITE_TEST_MODE: z.string().optional(),
  // Reported environment identity: exactly `local | development | production` (no 'staging',
  // no 'test'). This is the app's environment vocabulary, mirroring clinozy-be's `NODE_ENV`, and
  // is DECOUPLED from the Vite build mode — Vite 8 forbids a mode literally named `local`, so
  // the environment name is carried by this env variable (default `local`), not by the Vite
  // MODE constant. `development` / `production` are the two DEPLOY targets (DeployEnvironment);
  // you never deploy to `local`. Vite's own mode stays a mechanism detail (dev → `dev-server`,
  // build → `production`, Vitest → its default `test` mode). Reported name only, never branched
  // on — the raw Vite DEV/PROD booleans are intentionally unused (behavior is driven by named
  // flags). An out-of-enum value fails loudly at load (env.config.ts throws).
  VITE_APP_ENV: z.enum(['local', 'development', 'production']).default('local'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/** Cross-field invariants for auth platform switches. */
export function assertAuthPlatformInvariants(
  get: (key: string) => string | undefined,
): void {
  const oauthAutoGoogle = get('AUTH_OAUTH_AUTO_GOOGLE') === 'true';
  const oauthGoogleOff = get('AUTH_OAUTH_GOOGLE') === 'false';
  if (oauthAutoGoogle && oauthGoogleOff) {
    throw new Error(
      '[Config] VITE_AUTH_OAUTH_AUTO_GOOGLE=true requires VITE_AUTH_OAUTH_GOOGLE not false.',
    );
  }

  // The production Turnstile requirement is enforced at deploy time by
  // `validate:client-env` (envProfiles.production.required) — not a runtime
  // isProduction branch.

  const email = get('AUTH_EMAIL') !== 'false';
  const passkey = get('AUTH_PASSKEY') !== 'false';
  const oauth = resolveOAuthProviderFlags(get);
  if (!hasAnyAuthSurface({ email, passkey, oauth })) {
    if (resolveBooleanFlag(get('DEBUG_LOGGING'), false)) {
      console.warn(
        '[Config] No auth methods enabled (email, oauth providers, passkey). /login will show an empty state.',
      );
    }
  }
}
