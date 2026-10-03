import { describe, expect, it } from 'vitest';

import { CLINIC_MODULES, FIXTURE_BACKED_CLINIC_MODULES } from './clinic-modules.ts';
import { resolveDisabledModules } from './env-resolvers.ts';
import { envProfiles } from './env-schema.ts';

describe('clinic module keys (D8)', () => {
  it('gives each of the ten rooms its own clinic- key', () => {
    const keys = Object.values(CLINIC_MODULES);
    expect(keys).toHaveLength(10);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^clinic-[a-z]+$/);
  });

  it('production disables every fixture-backed room until its API lands', () => {
    const disabled = resolveDisabledModules(
      envProfiles.production.defaults?.VITE_DISABLED_MODULES,
    );
    for (const key of FIXTURE_BACKED_CLINIC_MODULES) expect(disabled.has(key)).toBe(true);
  });

  it('local and development keep the rooms on', () => {
    for (const env of ['local', 'development'] as const) {
      const disabled = resolveDisabledModules(
        envProfiles[env].defaults?.VITE_DISABLED_MODULES,
      );
      for (const key of Object.values(CLINIC_MODULES))
        expect(disabled.has(key)).toBe(false);
    }
  });
});
