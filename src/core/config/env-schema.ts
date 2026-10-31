/**
 * The whole env contract — every key (client, build, deploy and local tooling), its
 * description, and the per-environment profiles `validate:client-env` enforces. TOOLING ONLY:
 * the app never imports this module, so the deploy and tooling key names, the forbidden-value
 * rules and the profiles stay out of the shipped bundle (F-8). The client's own slice —
 * `clientEnvSchema` and the boot invariants — lives in {@link client-env-schema.ts}, which is
 * what `env.config.ts` reads; `env-schema.test.ts` keeps the two in step.
 */
import { z } from 'zod';

import { enabledOAuthProviders, resolveOAuthProviderFlags } from './env-resolvers.ts';

const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .string()
    .optional()
    .default(defaultValue)
    .transform((value) => value === 'true' || value === '1');

/** Keys documented in `.env.example` and validated at tooling time. */
export const envSchemaBase = z.object({
  // --- Build-time (Vite / CI — not VITE_ prefixed) ---
  BUILD_I18N_MODE: z.enum(['single', 'multi']).optional().default('single'),
  BUILD_I18N_LOCALE: z.string().min(1).optional().default('en-US'),

  // --- Runtime public (VITE_* — bundled client) ---
  // Reported environment identity — the app's environment vocabulary, NOT the Vite mode
  // (Vite 8 forbids a mode named `local`, so the environment name is env-driven instead).
  VITE_APP_ENV: z
    .enum(['local', 'development', 'production'])
    .optional()
    .default('local'),
  VITE_APP_VERSION: z.string().optional(),
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
  VITE_AUTH_EMAIL: booleanString('true'),
  VITE_AUTH_OAUTH_GOOGLE: booleanString('true'),
  VITE_AUTH_OAUTH_GITHUB: booleanString('true'),
  VITE_AUTH_OAUTH_APPLE: booleanString('false'),
  VITE_AUTH_OAUTH_AUTO_GOOGLE: booleanString('false'),
  VITE_AUTH_PASSKEY: booleanString('true'),
  VITE_CAPTCHA_DISABLED: z.string().optional(),
  VITE_TURNSTILE_SITE_KEY: z.string().optional(),

  // --- Platform diagnostics / dev tooling (VITE_* — bundled client) ---
  // Behavior is env-driven, never sniffed from the build mode: production
  // defaults are safe (logging/devtools/e2e off, version polling on); the
  // `.env.local` local file flips them on for dev.
  VITE_DEBUG_LOGGING: booleanString('false'),
  VITE_DEVTOOLS: booleanString('false'),
  VITE_E2E_HOOKS: booleanString('false'),
  VITE_VERSION_CHECK: booleanString('true'),

  // --- Runtime private (CI / build scripts only) ---
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),
  NETLIFY_AUTH_TOKEN: z.string().min(1).optional(),
  NETLIFY_SITE_ID: z.string().min(1).optional(),
  // Repository-level GitHub Actions PAT — not environment-scoped, never bundled,
  // never read by the app or the local dev server. Cataloged here for reference;
  // the real value lives in GitHub repository secrets (gh secret set --repo).
  RELEASE_PLEASE_TOKEN: z.string().min(1).optional(),
  CONTEXT7_API_KEY: z.string().min(1).optional(),

  // --- Local tooling only (never bundled / never set in CI) ---
  // SonarQube local quality gate — auto-managed in .env.local by tooling/sonar/sonar-gate.mjs.
  SONAR_ADMIN_PASSWORD: z.string().min(1).optional(),
  SONAR_TOKEN: z.string().min(1).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Build-INJECTED env — Vite `define` compile-time constants, NOT read from .env.
// Set by build plugins; deliberately absent from the schema above (and from
// .env.example's key list). Putting any of these in a .env file is a NO-OP — the
// `define` literal shadows the env value at build. Documented here for visibility:
//   VITE_APP_BUILD_ID         — build hash (plugins/version-json.ts) for new-deploy detection.
//   VITE_I18N_BUILD_MODE      — derived from BUILD_I18N_MODE  (plugins/i18n-build.ts): 'single' | 'multi'.
//   VITE_I18N_BUILD_BCP47     — derived from BUILD_I18N_LOCALE (plugins/i18n-build.ts).
//   VITE_I18N_BUILD_UI_LOCALE — derived from BUILD_I18N_LOCALE (plugins/i18n-build.ts).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-line description per env key — the SINGLE source of truth. `.env.example`
 * (and therefore each scaffolded `.env.<environment>`) mirrors these verbatim as
 * the `# comment` directly above each key, and `pnpm tool:sync-env-example` FAILS
 * if any drift — so the wording a developer reads in this schema is exactly what
 * they see in their env file. Every `envSchemaBase` key must have an entry
 * (enforced in env-schema.test.ts).
 */
export const envFieldDescriptions: Readonly<Record<string, string>> = {
  BUILD_I18N_MODE:
    'i18n build mode: single (inline one locale into JS) or multi (lazy JSON per locale).',
  BUILD_I18N_LOCALE: 'Primary i18n build locale, BCP-47 (e.g. en-US).',
  VITE_APP_ENV:
    'Reported environment: local (default) | development | production. The env vocabulary, not the Vite mode; reported-only (Sentry/PostHog tag), never branched on.',
  VITE_APP_VERSION:
    'App version string; read by vite.config.ts (names the Sentry release, fallback 0.0.0) and the client. CI-set; blank locally.',
  VITE_API_BASE_URL:
    'Production API base URL (e.g. https://api.example.com); empty = same-origin. Required in production when the API is not same-origin.',
  VITE_DEV_API_URL: 'Dev server only: Vite proxy target for /api.',
  VITE_SENTRY_DSN: 'Sentry DSN (public client key); empty disables Sentry.',
  VITE_SENTRY_TRACES_SAMPLE_RATE:
    'Sentry traces sample rate 0..1 (prod-safe default 0.1).',
  VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE:
    'Sentry session-replay sample rate 0..1 (prod-safe default 0.1).',
  VITE_SENTRY_PROFILES_SAMPLE_RATE: 'Sentry profiles sample rate 0..1 (default 1.0).',
  VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE:
    'Sentry on-error replay sample rate 0..1 (default 1.0).',
  VITE_POSTHOG_KEY: 'PostHog project key (optional); analytics is gated behind consent.',
  VITE_POSTHOG_HOST: 'PostHog host (optional); pairs with VITE_POSTHOG_KEY.',
  VITE_STRIPE_PUBLISHABLE_KEY:
    'Stripe publishable key (pk_test_ in dev, pk_live_ in prod); public, safe to expose.',
  VITE_LAYOUT_WIDTH: 'App layout width: contained (default), full, or reading.',
  VITE_THEME_LOCK:
    '"true" pins the theme mode: the Account menu hides its Light / Dark / System pills and Appearance shows a note in place of its Mode card.',
  VITE_PRIVACY_POLICY_URL:
    'Privacy-policy URL shown in the consent banner/footer (optional).',
  VITE_CSP_REPORT_URI:
    'CSP violation report collector URI (e.g. a Sentry CSP ingest URL); empty = violations reach each visitor console only. Warned on in both deploy environments.',
  VITE_DISABLED_MODULES:
    'Comma-separated module keys to disable (e.g. billing,members); routes 404 via the module gate. Clinic rooms are app-today … app-users and app-branches, every one on clinozy-be.',
  VITE_PERSONAL_ORGANIZATIONS:
    'Tri-state override for personal-org deployment mode (true/false/unset).',
  VITE_TEAM_ORGANIZATIONS:
    'Tri-state override for team-org deployment mode (true/false/unset).',
  VITE_AUTH_EMAIL: 'Enable email/OTP auth on /login (default true).',
  VITE_AUTH_OAUTH_GOOGLE: 'Enable Google OAuth on /login (default true).',
  VITE_AUTH_OAUTH_GITHUB: 'Enable GitHub OAuth on /login (default true).',
  VITE_AUTH_OAUTH_APPLE: 'Enable Apple OAuth on /login (default false).',
  VITE_AUTH_OAUTH_AUTO_GOOGLE:
    'Auto-start Google OAuth on /login; requires VITE_AUTH_OAUTH_GOOGLE not false (default false).',
  VITE_AUTH_PASSKEY: 'Enable passkey/WebAuthn auth on /login (default true).',
  VITE_CAPTCHA_DISABLED:
    '"true" disables the Turnstile CAPTCHA (local dev; pair with the clinozy-be test secret).',
  VITE_TURNSTILE_SITE_KEY:
    'Cloudflare Turnstile site key; required in production unless VITE_CAPTCHA_DISABLED is true.',
  VITE_DEBUG_LOGGING:
    '"true" emits [Module] diagnostic console logs (on locally and in the development deploy, off in production).',
  VITE_DEVTOOLS: '"true" mounts React Query Devtools + the localhost debug panel.',
  VITE_E2E_HOOKS:
    '"true" installs Playwright E2E hooks on globalThis (navigateInApp, establishSession).',
  VITE_VERSION_CHECK:
    '"true" polls /version.json for new deployments (off locally, on in deployed envs; never started by the test runner).',
  SENTRY_AUTH_TOKEN:
    'Sentry source-map upload token (CI only); see docs/integrations/sentry-sourcemaps.md.',
  SENTRY_ORG: 'Sentry organization slug (source-map upload).',
  SENTRY_PROJECT: 'Sentry project slug (source-map upload).',
  NETLIFY_AUTH_TOKEN: 'Netlify CLI deploy token (CI only).',
  NETLIFY_SITE_ID: 'Netlify site ID (deploy target).',
  RELEASE_PLEASE_TOKEN:
    'GitHub Actions PAT (environment secret on `development`) for release-please, dependabot-auto-merge, and the weekly PAT canary — all three jobs select `environment: development` to read it. Managed deploy secret on `development`: clinozy-infra (`pnpm setup:infra`) writes it into `.env.development` and `pnpm github:sync` pushes it; CI only — never bundled or read locally.',
  CONTEXT7_API_KEY:
    'Context7 docs-MCP API key; consumed by .mcp.json for the docs MCP (local tooling).',
  SONAR_ADMIN_PASSWORD:
    'Local SonarQube admin password; auto-managed by tooling/sonar/sonar-gate.mjs (never in CI).',
  SONAR_TOKEN:
    'Local SonarQube scanner token; auto-managed by the sonar gate (never in CI).',
};

/** Ordered list of env var names from the schema (for .env.example sync). */
export const envSchemaKeys = Object.keys(envSchemaBase.shape) as (keyof z.infer<
  typeof envSchemaBase
>)[];

// ─────────────────────────────────────────────────────────────────────────────
// Per-environment (branch-wise) env contracts
// ─────────────────────────────────────────────────────────────────────────────

/** Deploy environments — one per deploying branch (see .github/environments). */
export type DeployEnvironment = 'development' | 'production';

/**
 * All app environments with a load-time env contract. `local` is the default
 * developer machine (`.env.local`) — validated by `validate:client-env` like the
 * others, but NOT a deploy target (no GitHub environment, absent from
 * `branchEnvironmentMap` and the environment-drift check). One `.env.<env>` file
 * per name (`.env.local` / `.env.development` / `.env.production`), mirroring clinozy-be.
 */
export type AppEnvironment = 'local' | DeployEnvironment;

/**
 * Branch → deploy environment for the branch-wise `validate:client-env` gate.
 *
 * Single-trunk model (see `.github/environments/README.md`): `main` is the only
 * deploying branch, and it drives BOTH environments by purpose — every push
 * aliases to `development`, a release tag deploys to `production`. The gate
 * validates `main` against `production`, the strictest contract a `main` commit
 * can reach. Feature branches are unmapped → the gate skips them; validate the
 * `development` profile explicitly with `--env development`.
 */
export const branchEnvironmentMap: Readonly<Record<string, DeployEnvironment>> = {
  main: 'production',
};

/** Resolve the deploy environment for a git branch, or `undefined` if unmapped. */
export function environmentForBranch(
  branch: string | undefined,
): DeployEnvironment | undefined {
  if (!branch) return undefined;
  return branchEnvironmentMap[branch];
}

type EnvGet = (key: string) => string | undefined;

/** A key that must be set for an environment (optionally only under a condition). */
interface RequiredKeyRule {
  readonly key: string;
  /** Required only when this predicate is true. Omit = always required. */
  readonly when?: (get: EnvGet) => boolean;
  /** Human-readable condition, surfaced in messages and `.env.example`. */
  readonly condition?: string;
  /** `error` fails the gate; `warn` only reports. Defaults to `error`. */
  readonly level?: 'error' | 'warn';
  /** Set is not enough: the value must also pass this. Omit = any non-empty value. */
  readonly satisfiedBy?: (value: string) => boolean;
}

/**
 * Name words that mark a value as server-only. Every `VITE_` variable is bundled into the
 * browser, so a `VITE_` name made with one of these words is a secret about to ship to every
 * visitor (the planted-bug drill, 20 Oct 2026: `VITE_STRIPE_SECRET_KEY` passed every gate).
 */
const SECRET_NAME_WORDS: readonly string[] = ['SECRET', 'PRIVATE', 'PASSWORD'];

/** True when `key` is a client (`VITE_`) variable whose name says it holds a secret. */
export function isSecretNamedClientKey(key: string): boolean {
  return (
    key.startsWith('VITE_') &&
    key.split('_').some((word) => SECRET_NAME_WORDS.includes(word))
  );
}

/** A key that must NOT reach an environment (optionally only when value matches). */
export interface ForbiddenKeyRule {
  readonly key: string;
  /** Forbidden only when the value matches. Omit = key must be unset entirely. */
  readonly valuePattern?: RegExp;
  /** Why it is forbidden — shown in the validator error. */
  readonly reason: string;
}

/** Per-environment env contract enforced by `pnpm validate:client-env`. */
export interface EnvProfile {
  readonly required: readonly RequiredKeyRule[];
  readonly forbidden: readonly ForbiddenKeyRule[];
  /**
   * Strict allowed-value sets per key for this environment. If a key listed here
   * has a configured value outside its set, `validate:client-env` FAILS. This is
   * the per-environment "allowed values" contract — e.g. production allows only
   * the safe value for each diagnostics flag. Omitted key = any value allowed
   * (Zod still enforces enums/types at the schema layer).
   */
  readonly allowed?: Readonly<Record<string, readonly string[]>>;
  /**
   * Default value each env variable takes IN THIS ENVIRONMENT — the single source
   * of truth `pnpm setup:local` writes into `.env.<env>`, so each environment's
   * file comes pre-filled with that env's defaults. Only keys with an env-specific
   * default appear here (secrets/URLs are omitted — empty until set). Every default
   * MUST be within `allowed` for the same key (enforced in env-schema.test.ts).
   * NOT applied by the runtime: the app never branches on the environment — the
   * value reaches it through the env layer (`.env.<env>` / GitHub Environment).
   */
  readonly defaults?: Readonly<Record<string, string>>;
  /**
   * External credentials (`local` only): third-party integration keys whose development
   * value is also right on localhost. `pnpm setup:local` fills each into `.env.local` from
   * `.env.development`, else from the process environment (a cloud session's Variables) —
   * new file or top-up, never overwriting a value already set
   * (tooling/dev/external-credentials.ts). Keys whose local value differs on purpose stay off
   * this list: the API base and app environment, the Sentry DSN (local errors stay out of
   * Sentry unless set by hand), and the Turnstile site key (keys are bound to their domains).
   */
  readonly externalCredentials?: readonly string[];
}

/** Boolean flags whose allowed value differs by environment (dev: either; prod: safe). */
const BOOL = ['true', 'false'] as const;

/** Local-only tooling secrets that must never land in any committed deploy env. */
const SONAR_LOCAL_ONLY: readonly ForbiddenKeyRule[] = [
  {
    key: 'SONAR_TOKEN',
    reason: 'local-only SonarQube secret — never set in a committed/deploy env',
  },
  {
    key: 'SONAR_ADMIN_PASSWORD',
    reason: 'local-only SonarQube secret — never set in a committed/deploy env',
  },
];

/**
 * `local` + `development` share one CONTRACT (identical required/forbidden/allowed):
 * both are dev-tooling-on environments that may toggle diagnostics either way. They
 * differ only in their `defaults` (below) — `local` is the default local machine
 * (`.env.local`, dev-server proxy to localhost), `development` the deploy environment
 * (`.env.development`). `local` is validated at load but is never a deploy target.
 */
/**
 * Both deploy environments ship a `Content-Security-Policy-Report-Only` header
 * carrying `require-trusted-types-for 'script'` — emitted unconditionally by
 * `plugins/csp-api-origin.ts`. Without a collector the browser still surfaces
 * each violation in the visitor's own DevTools console, but nothing aggregates
 * them, so the promotion step documented in
 * `docs/deployment/runbooks/csp-trusted-types-production.md` ("promote to the
 * enforcing policy once the stream is clean") has no stream to read. `warn`,
 * never `error`: a deploy without violation collection is degraded, not broken.
 */
const CSP_REPORT_URI_RULE: RequiredKeyRule = {
  key: 'VITE_CSP_REPORT_URI',
  condition: 'deploy that collects CSP + Trusted-Types violations',
  level: 'warn',
};

const devLikeContract: Omit<EnvProfile, 'defaults'> = {
  required: [],
  forbidden: [
    ...SONAR_LOCAL_ONLY,
    {
      key: 'VITE_STRIPE_PUBLISHABLE_KEY',
      valuePattern: /^pk_live_/,
      reason:
        'live Stripe key must not be used in local/development — use a pk_test_… key',
    },
  ],
  // Local + development may toggle diagnostics either way (typos still rejected).
  allowed: {
    VITE_DEBUG_LOGGING: BOOL,
    VITE_DEVTOOLS: BOOL,
    VITE_E2E_HOOKS: BOOL,
    VITE_VERSION_CHECK: BOOL,
  },
};

/**
 * Per-environment env contracts (keyed by {@link AppEnvironment}). `required` is
 * checked against the resolved runtime env; `forbidden` is checked against
 * git-TRACKED `.env` + `.env.<env>` files only (gitignored local files like
 * `.env.local` are skipped), so local secrets never trip a deploy guard. `defaults`
 * are each environment's starting values: `pnpm setup:local` writes `local`'s into
 * `.env.local`, and `pnpm github:sync` writes `development`'s / `production`'s into a NEW
 * `.env.<env>` (tooling/setup/github/scaffold-env-files.mjs). Existing files are never
 * rewritten.
 */
export const envProfiles: Readonly<Record<AppEnvironment, EnvProfile>> = {
  local: {
    ...devLikeContract,
    allowed: { ...devLikeContract.allowed, VITE_APP_ENV: ['local'] },
    // Local machine: dev-tooling on, Vite proxy to the localhost backend,
    // version-check off (nothing deployed to detect).
    defaults: {
      VITE_APP_ENV: 'local',
      VITE_DEV_API_URL: 'http://localhost:3000',
      VITE_API_BASE_URL: '',
      VITE_DEBUG_LOGGING: 'true',
      VITE_DEVTOOLS: 'true',
      VITE_E2E_HOOKS: 'true',
      VITE_VERSION_CHECK: 'false',
      // Multi-locale so Appearance → Language works locally; prod defaults single.
      BUILD_I18N_MODE: 'multi',
      // Team-only deployment (D44): clinozy-be no longer sends the deployment flags on
      // me/context, so the front end states the mode itself.
      VITE_TEAM_ORGANIZATIONS: 'true',
      VITE_PERSONAL_ORGANIZATIONS: 'false',
      // Turnstile on, with Cloudflare's public always-pass TEST site key — it pairs with
      // clinozy-be's local test secret, so the real sign-in flow runs on localhost and in a
      // cloud session with no secret to hand over. Deploys use their own real key.
      VITE_CAPTCHA_DISABLED: 'false',
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
    // Test-mode Stripe (development forbids pk_live_) and PostHog work on localhost as-is.
    externalCredentials: [
      'VITE_STRIPE_PUBLISHABLE_KEY',
      'VITE_POSTHOG_KEY',
      'VITE_POSTHOG_HOST',
    ],
  },
  development: {
    ...devLikeContract,
    // Unlike `local`, development IS a deploy target: the deploy workflow must
    // inject VITE_APP_ENV so the shipped bundle self-reports its environment
    // (Sentry/PostHog tag) instead of falling back to the schema default `local`.
    required: [{ key: 'VITE_APP_ENV', level: 'error' }, CSP_REPORT_URI_RULE],
    allowed: { ...devLikeContract.allowed, VITE_APP_ENV: ['development'] },
    // Development deploy: diagnostics on for debugging, version-check on (a real
    // deploy), E2E hooks off (not a test runner).
    defaults: {
      VITE_APP_ENV: 'development',
      VITE_DEBUG_LOGGING: 'true',
      VITE_DEVTOOLS: 'true',
      VITE_E2E_HOOKS: 'false',
      VITE_VERSION_CHECK: 'true',
    },
  },
  production: {
    required: [
      // No `condition` on VITE_APP_ENV: it is unconditionally required in deploys
      // (and deliberately kept out of envSchemaConditionallyRequiredKeys, which
      // derives from rules that carry a condition string).
      { key: 'VITE_APP_ENV', level: 'error' },
      {
        key: 'VITE_TURNSTILE_SITE_KEY',
        when: (get) => get('VITE_CAPTCHA_DISABLED') !== 'true',
        condition: 'production build with VITE_CAPTCHA_DISABLED not true',
        level: 'error',
      },
      {
        key: 'VITE_API_BASE_URL',
        condition: 'production deploy when API is not same-origin',
        level: 'warn',
      },
      CSP_REPORT_URI_RULE,
    ],
    forbidden: [
      ...SONAR_LOCAL_ONLY,
      {
        key: 'VITE_STRIPE_PUBLISHABLE_KEY',
        valuePattern: /^pk_test_/,
        reason: 'test Stripe key must not ship to production — use a pk_live_… key',
      },
    ],
    // Production is strict: diagnostics/devtools/e2e off, version polling on.
    allowed: {
      VITE_APP_ENV: ['production'],
      VITE_DEBUG_LOGGING: ['false'],
      VITE_DEVTOOLS: ['false'],
      VITE_E2E_HOOKS: ['false'],
      VITE_VERSION_CHECK: ['true'],
    },
    // Production-safe defaults (each ∈ allowed above): diagnostics off, polling on.
    defaults: {
      VITE_APP_ENV: 'production',
      VITE_DEBUG_LOGGING: 'false',
      VITE_DEVTOOLS: 'false',
      VITE_E2E_HOOKS: 'false',
      VITE_VERSION_CHECK: 'true',
    },
  },
};

/**
 * Conditionally required keys surfaced in deploy validators — derived from the
 * production profile so the two never drift.
 */
export const envSchemaConditionallyRequiredKeys: ReadonlyArray<{
  readonly key: string;
  readonly condition: string;
}> = envProfiles.production.required
  .filter(
    (rule): rule is RequiredKeyRule & { condition: string } =>
      typeof rule.condition === 'string',
  )
  .map(({ key, condition }) => ({ key, condition }));

/** @internal Test helper — validate oauth provider list from flags. */
export function __testEnabledOAuthFromGet(get: (key: string) => string | undefined) {
  return enabledOAuthProviders(resolveOAuthProviderFlags(get));
}
