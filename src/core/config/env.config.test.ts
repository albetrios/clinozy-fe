import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BUILD_ONLY_CONFIG_KEYS,
  getClientEnv,
  resetClientEnvCacheForTests,
} from './env.config.ts';
import { envProfiles } from './env-schema.ts';

/** A fresh `env.config.ts` that read `runtime` as the deployed `window.__CONFIG__`. */
async function withRuntimeConfig(runtime: Record<string, string>) {
  vi.resetModules();
  vi.stubGlobal('window', Object.assign(window, { __CONFIG__: runtime }));
  try {
    return await import('./env.config.ts');
  } finally {
    Reflect.deleteProperty(window, '__CONFIG__');
  }
}

describe('env.config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetClientEnvCacheForTests();
  });

  it('getClientEnv caches the parsed client env', () => {
    const first = getClientEnv();
    const second = getClientEnv();
    expect(first).toBe(second);
  });

  it('fails closed on invalid client env — no per-mode fallback', () => {
    // VITE_LAYOUT_WIDTH is a strict enum; a bad value must throw in EVERY
    // environment (no `import.meta.env.PROD` throw-vs-warn branch anymore).
    vi.stubEnv('VITE_LAYOUT_WIDTH', 'not-a-valid-width');
    resetClientEnvCacheForTests();
    expect(() => getClientEnv()).toThrow(/Invalid environment configuration/);
  });

  it('resetClientEnvCacheForTests clears the cache', () => {
    const first = getClientEnv();
    resetClientEnvCacheForTests();
    const second = getClientEnv();
    expect(second).not.toBe(first);
    expect(second.VITE_APP_ENV).toBe(first.VITE_APP_ENV);
  });
});

describe('runtime config (window.__CONFIG__) — build-only keys (E-6)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('ignores a deployed config.js that switches on the E2E hooks, devtools or test mode', async () => {
    // What a production build carries (envProfiles.production.allowed) …
    const built = {
      APP_ENV: 'production',
      DEBUG_LOGGING: 'false',
      DEVTOOLS: 'false',
      E2E_HOOKS: 'false',
      VERSION_CHECK: 'true',
      TEST_MODE: 'false',
    };
    for (const [key, value] of Object.entries(built)) vi.stubEnv(`VITE_${key}`, value);
    // … and a config.js that says the opposite of each.
    const { getRuntimeConfigValue } = await withRuntimeConfig({
      APP_ENV: 'local',
      DEBUG_LOGGING: 'true',
      DEVTOOLS: 'true',
      E2E_HOOKS: 'true',
      VERSION_CHECK: 'false',
      TEST_MODE: 'true',
    });
    for (const [key, value] of Object.entries(built)) {
      expect(getRuntimeConfigValue(key), key).toBe(value);
    }
  });

  it('still lets a deployed config.js override an operator key', async () => {
    const { getRuntimeConfigValue } = await withRuntimeConfig({
      AUTH_OAUTH_GITHUB: 'false',
      SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2',
    });
    expect(getRuntimeConfigValue('AUTH_OAUTH_GITHUB')).toBe('false');
    expect(getRuntimeConfigValue('SENTRY_DSN')).toBe('https://key@o1.ingest.sentry.io/2');
  });

  it('holds every switch the production profile pins, and the test runner’s mark', () => {
    const pinned = Object.keys(envProfiles.production.allowed ?? {}).map((key) =>
      key.replace(/^VITE_/, ''),
    );
    expect([...BUILD_ONLY_CONFIG_KEYS].sort()).toEqual([...pinned, 'TEST_MODE'].sort());
  });
});
