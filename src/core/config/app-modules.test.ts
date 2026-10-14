import { describe, expect, it } from 'vitest';

import { APP_MODULES } from './app-modules.ts';
import { resolveDisabledModules } from './env-resolvers.ts';
import { envProfiles } from './env-schema.ts';

describe('clinic module keys (D8)', () => {
  it('gives each of the ten rooms its own app- key', () => {
    const keys = Object.values(APP_MODULES);
    expect(keys).toHaveLength(10);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^app-[a-z]+$/);
  });

  it('local and development keep the rooms on', () => {
    for (const env of ['local', 'development'] as const) {
      const disabled = resolveDisabledModules(
        envProfiles[env].defaults?.VITE_DISABLED_MODULES,
      );
      for (const key of Object.values(APP_MODULES)) expect(disabled.has(key)).toBe(false);
    }
  });
});
