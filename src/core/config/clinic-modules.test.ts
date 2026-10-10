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

  it('takes Leads, Appointments, Patients, Offerings, Stock, Tasks, Today and Payments off the fixtures — they are on the API', () => {
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.leads);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.appointments);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.patients);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.offerings);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.stock);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.tasks);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.today);
    expect(FIXTURE_BACKED_CLINIC_MODULES).not.toContain(CLINIC_MODULES.payments);
    expect(FIXTURE_BACKED_CLINIC_MODULES).toEqual([
      CLINIC_MODULES.medical,
      CLINIC_MODULES.users,
    ]);
  });

  it('production disables every fixture-backed room until its API lands', () => {
    const disabled = resolveDisabledModules(
      envProfiles.production.defaults?.VITE_DISABLED_MODULES,
    );
    for (const key of FIXTURE_BACKED_CLINIC_MODULES) expect(disabled.has(key)).toBe(true);
    expect(disabled.has(CLINIC_MODULES.leads)).toBe(false);
    expect(disabled.has(CLINIC_MODULES.appointments)).toBe(false);
    expect(disabled.has(CLINIC_MODULES.patients)).toBe(false);
    expect(disabled.has(CLINIC_MODULES.offerings)).toBe(false);
    expect(disabled.has(CLINIC_MODULES.stock)).toBe(false);
    expect(disabled.has(CLINIC_MODULES.tasks)).toBe(false);
    expect(disabled.has(CLINIC_MODULES.today)).toBe(false);
    expect(disabled.has(CLINIC_MODULES.payments)).toBe(false);
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
