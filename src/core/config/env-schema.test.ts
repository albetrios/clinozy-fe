import { assertAuthPlatformInvariants, clientEnvSchema } from './client-env-schema.ts';
import {
  branchEnvironmentMap,
  type DeployEnvironment,
  envFieldDescriptions,
  environmentForBranch,
  envProfiles,
  envSchemaConditionallyRequiredKeys,
  envSchemaKeys,
  type ForbiddenKeyRule,
  HOSTED_DEPLOYMENT_REFUSED_SWITCHES,
  hostedDeploymentRefusals,
  isSecretNamedClientKey,
} from './env-schema.ts';

/** Mirrors the validator's forbidden matcher (tooling/validate/client-env.ts). */
function isForbidden(rule: ForbiddenKeyRule, value: string): boolean {
  return rule.valuePattern ? rule.valuePattern.test(value) : true;
}

function forbiddenHits(
  environment: DeployEnvironment,
  committed: Record<string, string>,
): string[] {
  return envProfiles[environment].forbidden
    .filter((rule) => {
      const value = committed[rule.key];
      return value !== undefined && isForbidden(rule, value);
    })
    .map((rule) => rule.key);
}

describe('environmentForBranch', () => {
  it('maps the single deploying branch (main) to its environment', () => {
    expect(environmentForBranch('main')).toBe('production');
  });

  it('returns undefined for non-deploying branches and missing input', () => {
    // Single-trunk: no `dev` branch — only `main` maps.
    expect(environmentForBranch('dev')).toBeUndefined();
    expect(environmentForBranch('feature/foo')).toBeUndefined();
    expect(environmentForBranch(undefined)).toBeUndefined();
    expect(environmentForBranch('')).toBeUndefined();
  });

  it('stays in lock step with branchEnvironmentMap', () => {
    expect(branchEnvironmentMap).toEqual({ main: 'production' });
  });
});

describe('isSecretNamedClientKey (a VITE_ value ships to the browser)', () => {
  it('flags a client variable whose name says it holds a secret', () => {
    // The planted-bug drill (20 Oct 2026) added VITE_STRIPE_SECRET_KEY to .env.example; it passed.
    expect(isSecretNamedClientKey('VITE_STRIPE_SECRET_KEY')).toBe(true);
    expect(isSecretNamedClientKey('VITE_DATABASE_PASSWORD')).toBe(true);
    expect(isSecretNamedClientKey('VITE_PRIVATE_KEY')).toBe(true);
  });

  it('passes every name the schema has, and server-only or look-alike names', () => {
    expect(envSchemaKeys.filter((key) => isSecretNamedClientKey(key))).toEqual([]);
    expect(isSecretNamedClientKey('VITE_PRIVACY_POLICY_URL')).toBe(false);
    expect(isSecretNamedClientKey('VITE_STRIPE_PUBLISHABLE_KEY')).toBe(false);
    expect(isSecretNamedClientKey('SONAR_ADMIN_PASSWORD')).toBe(false);
  });
});

describe('envProfiles forbidden keys', () => {
  it('blocks local-only Sonar secrets in every environment', () => {
    for (const environment of ['development', 'production'] as const) {
      expect(forbiddenHits(environment, { SONAR_TOKEN: 'x' })).toContain('SONAR_TOKEN');
      expect(forbiddenHits(environment, { SONAR_ADMIN_PASSWORD: 'x' })).toContain(
        'SONAR_ADMIN_PASSWORD',
      );
    }
  });

  it('blocks a test Stripe key in production but allows a live key', () => {
    expect(
      forbiddenHits('production', { VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_1' }),
    ).toContain('VITE_STRIPE_PUBLISHABLE_KEY');
    expect(
      forbiddenHits('production', { VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_1' }),
    ).toEqual([]);
  });

  it('blocks a live Stripe key in development but allows a test key', () => {
    expect(
      forbiddenHits('development', { VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_1' }),
    ).toContain('VITE_STRIPE_PUBLISHABLE_KEY');
    expect(
      forbiddenHits('development', { VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_1' }),
    ).toEqual([]);
  });

  it('refuses the dev proxy target in every deploy, but not locally', () => {
    for (const environment of ['development', 'production'] as const) {
      expect(
        forbiddenHits(environment, { DEV_API_URL: 'http://localhost:3000' }),
      ).toEqual(['DEV_API_URL']);
    }
    expect(envProfiles.local.forbidden.map((rule) => rule.key)).not.toContain(
      'DEV_API_URL',
    );
    expect(envProfiles.local.defaults?.DEV_API_URL).toBe('http://localhost:3000');
  });

  it('refuses an API base on the local machine in every deploy', () => {
    for (const environment of ['development', 'production'] as const) {
      for (const base of [
        'http://localhost:3000',
        'http://localhost',
        'http://127.0.0.1:3000/api',
        'http://[::1]:3000',
      ]) {
        expect(forbiddenHits(environment, { VITE_API_BASE_URL: base }), base).toEqual([
          'VITE_API_BASE_URL',
        ]);
      }
      for (const base of ['https://api.clinozy.com', 'https://localhost.clinozy.com']) {
        expect(forbiddenHits(environment, { VITE_API_BASE_URL: base }), base).toEqual([]);
      }
    }
  });

  it("refuses Cloudflare's test Turnstile keys in production only", () => {
    for (const key of ['1x00000000000000000000AA', '2x00000000000000000000AB']) {
      expect(forbiddenHits('production', { VITE_TURNSTILE_SITE_KEY: key })).toEqual([
        'VITE_TURNSTILE_SITE_KEY',
      ]);
      expect(forbiddenHits('development', { VITE_TURNSTILE_SITE_KEY: key })).toEqual([]);
    }
    expect(
      forbiddenHits('production', { VITE_TURNSTILE_SITE_KEY: '0x4AAAAAAArealkey' }),
    ).toEqual([]);
  });
});

describe('envProfiles required keys', () => {
  it('requires Turnstile in production only when captcha is enabled', () => {
    const rule = envProfiles.production.required.find(
      (r) => r.key === 'VITE_TURNSTILE_SITE_KEY',
    );
    expect(rule).toBeDefined();
    expect(rule?.level).toBe('error');
    expect(rule?.when?.(() => undefined)).toBe(true);
    expect(
      rule?.when?.((key) => (key === 'VITE_CAPTCHA_DISABLED' ? 'true' : undefined)),
    ).toBe(false);
  });

  it('requires production to name its file-store bucket as an https origin; warns development (F-7)', () => {
    const production = envProfiles.production.required.find(
      (r) => r.key === 'STORED_FILES_ORIGIN',
    );
    expect(production?.level).toBe('error');
    expect(
      production?.satisfiedBy?.('https://clinozy-files.s3.ap-south-1.amazonaws.com'),
    ).toBe(true);
    expect(production?.satisfiedBy?.('https://clinozy-files.s3.amazonaws.com/')).toBe(
      true,
    );
    for (const wrong of [
      'https://*.amazonaws.com',
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- asserting http:// is rejected
      'http://clinozy-files.s3.amazonaws.com',
      'https://clinozy-files.s3.amazonaws.com/uploads',
      'clinozy-files',
    ]) {
      expect(production?.satisfiedBy?.(wrong), wrong).toBe(false);
    }
    const development = envProfiles.development.required.find(
      (r) => r.key === 'STORED_FILES_ORIGIN',
    );
    expect(development?.level).toBe('warn');
    expect(
      envProfiles.local.required.some(
        (candidate) => candidate.key === 'STORED_FILES_ORIGIN',
      ),
    ).toBe(false);
  });

  it('derives the conditionally-required list from the production profile', () => {
    const keys = envSchemaConditionallyRequiredKeys.map((entry) => entry.key);
    expect(keys).toEqual([
      'VITE_TURNSTILE_SITE_KEY',
      'VITE_API_BASE_URL',
      'CSP_REPORT_URI',
    ]);
    for (const entry of envSchemaConditionallyRequiredKeys) {
      expect(entry.condition.length).toBeGreaterThan(0);
    }
  });

  it('no longer requires a production deploy to switch a clinic room off — every room is live', () => {
    for (const env of ['development', 'production'] as const) {
      expect(
        envProfiles[env].required.some(
          (candidate) => candidate.key === 'VITE_DISABLED_MODULES',
        ),
      ).toBe(false);
    }
    expect(envProfiles.production.defaults?.VITE_DISABLED_MODULES).toBeUndefined();
  });

  it('requires VITE_APP_ENV unconditionally in both deploy environments', () => {
    // Deploys must self-report their environment (Sentry/PostHog tag); without
    // this rule an un-injected VITE_APP_ENV silently falls back to `local`.
    for (const env of ['development', 'production'] as const) {
      const rule = envProfiles[env].required.find((r) => r.key === 'VITE_APP_ENV');
      expect(rule, `${env} must require VITE_APP_ENV`).toBeDefined();
      expect(rule?.level).toBe('error');
      expect(rule?.when).toBeUndefined();
      expect(rule?.condition).toBeUndefined();
    }
    expect(envProfiles.local.required.some((r) => r.key === 'VITE_APP_ENV')).toBe(false);
  });

  it('warns — never fails — when a deploy has no CSP violation collector', () => {
    // Both deploy environments ship `Content-Security-Policy-Report-Only:
    // require-trusted-types-for 'script'` unconditionally. With no collector the
    // browser reports each violation to the visitor's own console and nowhere
    // else, so the "promote to enforcing once the stream is clean" step has no
    // stream. Surface that as a warning: missing collection is degraded, not broken.
    const deployProfiles = [
      ['development', envProfiles.development],
      ['production', envProfiles.production],
    ] as const;
    for (const [env, profile] of deployProfiles) {
      const rule = profile.required.find((r) => r.key === 'CSP_REPORT_URI');
      expect(rule, `${env} must flag a missing CSP collector`).toBeDefined();
      expect(rule?.level).toBe('warn');
      expect(rule?.condition).toBeTruthy();
      // Unconditional: `when` would let an unset collector pass silently.
      expect(rule?.when).toBeUndefined();
    }
    // `local` never deploys, so it has no collector to miss.
    expect(envProfiles.local.required.some((r) => r.key === 'CSP_REPORT_URI')).toBe(
      false,
    );
  });
});

describe('envProfiles allowed values (strict per-environment)', () => {
  it('production permits only the safe value for each diagnostics flag', () => {
    const allowed = envProfiles.production.allowed;
    expect(allowed).toBeDefined();
    expect(allowed?.VITE_CAPTCHA_DISABLED).toEqual(['false']);
    expect(allowed?.VITE_DEBUG_LOGGING).toEqual(['false']);
    expect(allowed?.VITE_DEVTOOLS).toEqual(['false']);
    expect(allowed?.VITE_E2E_HOOKS).toEqual(['false']);
    expect(allowed?.VITE_VERSION_CHECK).toEqual(['true']);
  });

  it('development permits either boolean value for diagnostics flags', () => {
    const allowed = envProfiles.development.allowed;
    expect(allowed?.VITE_DEBUG_LOGGING).toEqual(['true', 'false']);
    expect(allowed?.VITE_DEVTOOLS).toEqual(['true', 'false']);
    expect(allowed?.VITE_E2E_HOOKS).toEqual(['true', 'false']);
    expect(allowed?.VITE_VERSION_CHECK).toEqual(['true', 'false']);
  });

  it('rejects a disallowed production value (mirrors the validator check)', () => {
    const debug = envProfiles.production.allowed?.VITE_DEBUG_LOGGING ?? [];
    expect(debug.includes('true')).toBe(false);
    expect(debug.includes('false')).toBe(true);
    const versionCheck = envProfiles.production.allowed?.VITE_VERSION_CHECK ?? [];
    expect(versionCheck.includes('false')).toBe(false);
    expect(versionCheck.includes('true')).toBe(true);
  });
});

describe('envProfiles defaults (per-environment starting values)', () => {
  it('every default value is within the allowed set for its key', () => {
    for (const env of ['local', 'development', 'production'] as const) {
      const { defaults, allowed } = envProfiles[env];
      for (const [key, value] of Object.entries(defaults ?? {})) {
        const permitted = allowed?.[key];
        // Keys without an `allowed` constraint (URLs/secrets) accept any default.
        if (permitted) {
          expect(
            permitted,
            `${env}.defaults.${key}=${value} must be within allowed`,
          ).toContain(value);
        }
      }
    }
  });

  it('production defaults are production-safe (diagnostics off, version-check on)', () => {
    const defaults = envProfiles.production.defaults;
    expect(defaults?.VITE_DEBUG_LOGGING).toBe('false');
    expect(defaults?.VITE_DEVTOOLS).toBe('false');
    expect(defaults?.VITE_E2E_HOOKS).toBe('false');
    expect(defaults?.VITE_VERSION_CHECK).toBe('true');
  });

  it('development defaults keep test-only switches off and Turnstile on', () => {
    const defaults = envProfiles.development.defaults;
    expect(defaults?.VITE_CAPTCHA_DISABLED).toBe('false');
    expect(defaults?.VITE_DEBUG_LOGGING).toBe('false');
    expect(defaults?.VITE_DEVTOOLS).toBe('false');
  });

  it('local defaults turn dev-tooling on and point at the localhost backend', () => {
    const defaults = envProfiles.local.defaults;
    expect(defaults?.VITE_DEBUG_LOGGING).toBe('true');
    expect(defaults?.VITE_DEVTOOLS).toBe('true');
    expect(defaults?.DEV_API_URL).toBe('http://localhost:3000');
  });
});

// clinozy-be's A-4: test-only switches are refused on every hosted deploy — the deploy workflows
// set HOSTED_DEPLOYMENT=true — and stay allowed on local machines and CI runners.
describe('hostedDeploymentRefusals (the hosted-deploy marker)', () => {
  const hosted = (env: Record<string, string>) => (key: string) =>
    ({ HOSTED_DEPLOYMENT: 'true', VITE_APP_ENV: 'development', ...env })[key];

  it.each(Object.keys(HOSTED_DEPLOYMENT_REFUSED_SWITCHES))(
    'refuses %s on a hosted deploy, whatever value turns it on',
    (key) => {
      for (const value of ['true', '1', 'yes']) {
        const [error] = hostedDeploymentRefusals(hosted({ [key]: value }));
        expect(error).toContain(`${key}=${value} is refused on a hosted deploy`);
      }
      expect(hostedDeploymentRefusals(hosted({ [key]: 'false' }))).toEqual([]);
      expect(hostedDeploymentRefusals(hosted({ [key]: '' }))).toEqual([]);
    },
  );

  it('names the test-only switches clinozy-be refuses the counterparts of', () => {
    expect(Object.keys(HOSTED_DEPLOYMENT_REFUSED_SWITCHES).sort()).toEqual([
      'VITE_DEBUG_LOGGING',
      'VITE_DEVTOOLS',
      'VITE_E2E_HOOKS',
      'VITE_TEST_MODE',
    ]);
  });

  it('allows every switch off a hosted deploy (local machines, CI runners)', () => {
    const all = Object.fromEntries(
      Object.keys(HOSTED_DEPLOYMENT_REFUSED_SWITCHES).map((key) => [key, 'true']),
    );
    for (const marker of [undefined, '', 'false']) {
      const get = (key: string) =>
        key === 'HOSTED_DEPLOYMENT' ? marker : (all as Record<string, string>)[key];
      expect(hostedDeploymentRefusals(get)).toEqual([]);
    }
  });

  it('reads a marker that is neither true nor false as an error, never as "not hosted"', () => {
    expect(hostedDeploymentRefusals(hosted({ HOSTED_DEPLOYMENT: 'yes' }))).toEqual([
      'HOSTED_DEPLOYMENT=yes must be true or false',
    ]);
  });

  it('refuses the marker on the local environment (a deploy names a deploy target)', () => {
    expect(hostedDeploymentRefusals(hosted({ VITE_APP_ENV: 'local' }))).toEqual([
      'HOSTED_DEPLOYMENT=true names a deploy, so VITE_APP_ENV must be development or production, not local',
    ]);
  });

  it('every deploy environment starts with each refused switch off', () => {
    for (const environment of ['development', 'production'] as const) {
      const defaults = envProfiles[environment].defaults ?? {};
      expect(
        hostedDeploymentRefusals(hosted({ ...defaults, VITE_APP_ENV: environment })),
        environment,
      ).toEqual([]);
    }
  });
});

describe('assertAuthPlatformInvariants', () => {
  it('does not throw when no auth surface is enabled (runs the warn path)', () => {
    const allAuthOff = (key: string) => (key.startsWith('AUTH_') ? 'false' : undefined);
    expect(() => assertAuthPlatformInvariants(allAuthOff)).not.toThrow();
  });

  it('throws when auto-google is on but google is off', () => {
    const get = (key: string) => {
      if (key === 'AUTH_OAUTH_AUTO_GOOGLE') return 'true';
      if (key === 'AUTH_OAUTH_GOOGLE') return 'false';
      return undefined;
    };
    expect(() => assertAuthPlatformInvariants(get)).toThrow(/AUTO_GOOGLE/);
  });
});

describe('envProfiles.local.externalCredentials (keys .env.local takes from development)', () => {
  const externalCredentials = envProfiles.local.externalCredentials ?? [];

  it('lists only schema keys, none of which local already defaults', () => {
    expect(externalCredentials.length).toBeGreaterThan(0);
    for (const key of externalCredentials) {
      expect(envSchemaKeys, key).toContain(key);
      expect(Object.keys(envProfiles.local.defaults ?? {}), key).not.toContain(key);
    }
  });

  it('never takes a key whose local value differs on purpose, or a deploy secret', () => {
    for (const key of [
      'VITE_API_BASE_URL',
      'DEV_API_URL',
      'VITE_APP_ENV',
      'VITE_SENTRY_DSN',
      'VITE_TURNSTILE_SITE_KEY',
      'SENTRY_AUTH_TOKEN',
      'NETLIFY_AUTH_TOKEN',
      'SONAR_TOKEN',
    ]) {
      expect(externalCredentials, key).not.toContain(key);
    }
  });
});

describe('envSchemaKeys', () => {
  it('includes the Stripe publishable key', () => {
    expect(envSchemaKeys).toContain('VITE_STRIPE_PUBLISHABLE_KEY');
  });

  it('includes the local Sonar tooling secrets', () => {
    expect(envSchemaKeys).toContain('SONAR_TOKEN');
    expect(envSchemaKeys).toContain('SONAR_ADMIN_PASSWORD');
  });
});

describe('envFieldDescriptions', () => {
  it('has a non-empty description for every schema key (single source for .env.example)', () => {
    const missing = envSchemaKeys.filter((key) => !envFieldDescriptions[key]?.trim());
    expect(missing, `keys without a description: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no descriptions for keys absent from the schema', () => {
    const known = new Set<string>(envSchemaKeys);
    const extra = Object.keys(envFieldDescriptions).filter((key) => !known.has(key));
    expect(extra, `descriptions with no schema key: ${extra.join(', ')}`).toEqual([]);
  });
});

describe('VITE_APP_ENV enum (reported environment identity)', () => {
  it('accepts `local` (developer machine — mirrors clinozy-be NODE_ENV=local)', () => {
    const parsed = clientEnvSchema.safeParse({ VITE_APP_ENV: 'local' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.VITE_APP_ENV).toBe('local');
  });

  it('defaults to local when unset (mirrors clinozy-be NODE_ENV=local)', () => {
    const parsed = clientEnvSchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.VITE_APP_ENV).toBe('local');
  });

  it('accepts the two deploy environments (`development`, `production`)', () => {
    expect(clientEnvSchema.safeParse({ VITE_APP_ENV: 'development' }).success).toBe(true);
    expect(clientEnvSchema.safeParse({ VITE_APP_ENV: 'production' }).success).toBe(true);
  });

  it('rejects `test` — it is not an environment; a Vitest run is marked by VITE_TEST_MODE', () => {
    // The environment vocabulary is exactly local/development/production. A test run is
    // flagged by VITE_TEST_MODE, decoupled from the Vite mode.
    expect(clientEnvSchema.safeParse({ VITE_APP_ENV: 'test' }).success).toBe(false);
  });

  it('fails loudly on an out-of-enum value (e.g. qa) — never a silent default', () => {
    // env.config.ts eager-parses clientEnvSchema and throws on failure.
    expect(clientEnvSchema.safeParse({ VITE_APP_ENV: 'qa' }).success).toBe(false);
  });
});
