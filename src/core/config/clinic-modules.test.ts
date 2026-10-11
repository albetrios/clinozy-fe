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

  it('takes every room but Medical off the fixtures — they are on the API', () => {
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.leads);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.appointments);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.patients);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.offerings);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.stock);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.tasks);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.today);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.payments);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.users);
    expect(FIXTURE_BACKED_CLINIC_MODULES).toEqual([CLINIC_MODULES.medical]);
  });

  it('a production deploy must switch off exactly the fixture-backed rooms to pass (D8)', () => {
    const rule = envProfiles.production.required.find(
      (candidate) => candidate.key === 'VITE_DISABLED_MODULES',
    );
    expect(rule?.satisfiedBy?.(FIXTURE_BACKED_CLINIC_MODULES.join(','))).toBe(true);
    // Every live room may stay on: naming only the fixture-backed ones is enough.
    const live = Object.values(CLINIC_MODULES).filter(
      (key) => !FIXTURE_BACKED_CLINIC_MODULES.includes(key),
    );
    expect(rule?.satisfiedBy?.(live.join(','))).toBe(false);
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
