import { afterEach, describe, expect, it, vi } from 'vitest';

import { getClientEnv, resetClientEnvCacheForTests } from './env.config.ts';

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
