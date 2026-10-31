/**
 * Runtime environment bootstrap — validates `import.meta.env` and exposes
 * {@link getRuntimeConfigValue} for `window.__CONFIG__` overrides.
 */
import { z } from 'zod';

import {
  assertAuthPlatformInvariants,
  type ClientEnv,
  clientEnvSchema,
} from './env-schema.ts';

export type { ClientEnv };

let _clientEnv: ClientEnv | null = null;

/** Lazily parse and cache validated client env. */
export function getClientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv;

  const parsed = clientEnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    // Fail-closed in every environment — invalid config is a real error, not a
    // per-mode branch. No `import.meta.env.PROD` / NODE_ENV check.
    const detail = JSON.stringify(z.flattenError(parsed.error));
    throw new Error(`[Config] Invalid environment configuration: ${detail}`);
  }

  _clientEnv = parsed.data;
  return _clientEnv;
}

/** Test-only: reset cached client env. */
export function resetClientEnvCacheForTests(): void {
  _clientEnv = null;
}

const runtimeConfig: Record<string, string> =
  typeof window !== 'undefined'
    ? (((window as unknown as Record<string, unknown>).__CONFIG__ as
        Record<string, string> | undefined) ?? {})
    : {};

/**
 * Keys only the build's own env sets — a deployed `config.js` (`window.__CONFIG__`) naming one is
 * ignored. They are the switches `envProfiles.production.allowed` pins to one value (the
 * environment name, diagnostics, devtools, E2E hooks, version polling) and the test runner's mark,
 * so no runtime file can switch on in a production build what `validate:client-env` holds off
 * there — `establishSession` on `globalThis`, the devtools panel. One rule for every
 * environment, never a mode branch: a build that needs one of them on sets it in its own env.
 * Declared here, not read from `env-schema.ts` (the tooling-side contract stays off the entry
 * chunk); `env.config.test.ts` pins it to the production profile.
 */
export const BUILD_ONLY_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'APP_ENV',
  'DEBUG_LOGGING',
  'DEVTOOLS',
  'E2E_HOOKS',
  'VERSION_CHECK',
  'TEST_MODE',
]);

/**
 * Read a config value: runtime (`window.__CONFIG__`) → `import.meta.env.VITE_*`. A
 * {@link BUILD_ONLY_CONFIG_KEYS} key skips the runtime layer.
 */
export function getRuntimeConfigValue(key: string): string | undefined {
  const runtime = BUILD_ONLY_CONFIG_KEYS.has(key) ? undefined : runtimeConfig[key];
  return runtime ?? (import.meta.env[`VITE_${key}`] as string | undefined) ?? undefined;
}

/** Run cross-field auth/platform invariant checks once at boot. */
export function validatePlatformInvariantsAtBoot(): void {
  assertAuthPlatformInvariants(getRuntimeConfigValue);
}
