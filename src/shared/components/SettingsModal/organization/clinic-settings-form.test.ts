import { describe, expect, it } from 'vitest';

import { CLINIC_SETTINGS_LIMITS } from '@/shared/api/app/clinic-api.ts';

import {
  clinicProfileChange,
  clinicProfileSchema,
  clinicSettingsChange,
  clinicSettingsSchema,
  clinicTimeZones,
  curatedTimeZoneName,
  hasClinicChange,
} from './clinic-settings-form.ts';

const SAVED_PROFILE = {
  specialties: ['skin' as const, 'hair' as const],
  timezone: 'Asia/Kolkata',
};
const SAVED_SETTINGS = { reminderHour: 16, leadHoldDays: 3, retargetAfterDays: 90 };

describe('clinicProfileChange', () => {
  it('sends nothing when nothing changed', () => {
    const change = clinicProfileChange(SAVED_PROFILE, { ...SAVED_PROFILE });
    expect(change).toEqual({});
    expect(hasClinicChange(change)).toBe(false);
  });

  it('sends only the specialties when only they changed', () => {
    expect(
      clinicProfileChange(SAVED_PROFILE, { ...SAVED_PROFILE, specialties: ['skin'] }),
    ).toEqual({ specialties: ['skin'] });
  });

  // The first specialty is the clinic's main one (Q-O6), so a new order is a change.
  it('counts a new order of the same specialties as a change', () => {
    expect(
      clinicProfileChange(SAVED_PROFILE, {
        ...SAVED_PROFILE,
        specialties: ['hair', 'skin'],
      }),
    ).toEqual({ specialties: ['hair', 'skin'] });
  });

  it('sends a changed timezone, trimmed', () => {
    expect(
      clinicProfileChange(SAVED_PROFILE, { ...SAVED_PROFILE, timezone: ' Asia/Dubai ' }),
    ).toEqual({ timezone: 'Asia/Dubai' });
  });
});

describe('clinicSettingsChange', () => {
  it('sends only the values that differ', () => {
    const change = clinicSettingsChange(SAVED_SETTINGS, {
      ...SAVED_SETTINGS,
      reminderHour: 0,
      retargetAfterDays: 120,
    });
    expect(change).toEqual({ reminderHour: 0, retargetAfterDays: 120 });
    expect(hasClinicChange(change)).toBe(true);
  });

  it('sends nothing for the saved values', () => {
    expect(clinicSettingsChange(SAVED_SETTINGS, { ...SAVED_SETTINGS })).toEqual({});
  });
});

describe('clinicProfileSchema', () => {
  const schema = clinicProfileSchema({
    specialtiesRequired: 'Pick one',
    timezoneRequired: 'Pick a zone',
  });

  it('needs at least one specialty and a timezone', () => {
    const result = schema.safeParse({ specialties: [], timezone: ' ' });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining(['Pick one', 'Pick a zone']));
  });

  it('refuses a specialty the contract does not have', () => {
    expect(schema.safeParse({ specialties: ['eyes'], timezone: 'UTC' }).success).toBe(
      false,
    );
  });

  it('accepts the six specialties', () => {
    expect(
      schema.safeParse({
        specialties: ['skin', 'hair', 'dental', 'gynac', 'physio', 'general'],
        timezone: 'Asia/Kolkata',
      }).success,
    ).toBe(true);
  });
});

describe('clinicSettingsSchema', () => {
  const schema = clinicSettingsSchema(({ min, max }) => `${min}–${max}`);

  // clinozy-be's organization-settings.dto.ts: reminder 0–23, hold 1–30, retarget 7–730.
  it.each([
    ['reminderHour', CLINIC_SETTINGS_LIMITS.reminderHour],
    ['leadHoldDays', CLINIC_SETTINGS_LIMITS.leadHoldDays],
    ['retargetAfterDays', CLINIC_SETTINGS_LIMITS.retargetAfterDays],
  ] as const)('holds %s to clinozy-be’s limits', (field, limits) => {
    const at = (value: number) => schema.safeParse({ ...SAVED_SETTINGS, [field]: value });
    expect(at(limits.min).success).toBe(true);
    expect(at(limits.max).success).toBe(true);
    expect(at(limits.min - 1).error?.issues[0]?.message).toBe(
      `${limits.min}–${limits.max}`,
    );
    expect(at(limits.max + 1).success).toBe(false);
    expect(at(limits.min + 0.5).success).toBe(false);
  });

  it('pins the limits clinozy-be enforces', () => {
    expect(CLINIC_SETTINGS_LIMITS).toEqual({
      reminderHour: { min: 0, max: 23 },
      leadHoldDays: { min: 1, max: 30 },
      retargetAfterDays: { min: 7, max: 730 },
    });
  });
});

describe('clinicTimeZones', () => {
  it('always offers the clinic’s current zone, even one the runtime does not list', () => {
    expect(clinicTimeZones('Mars/Olympus_Mons')).toContain('Mars/Olympus_Mons');
  });

  // V8 lists India only as `Asia/Calcutta`; the curated list brings `Asia/Kolkata` back.
  it('carries the curated zones and leaves out the device choice', () => {
    const zones = clinicTimeZones('');
    expect(zones).toContain('Asia/Kolkata');
    expect(zones).toContain('UTC');
    expect(zones).not.toContain('auto');
    expect(zones).not.toContain('');
  });

  it('is sorted with no duplicates', () => {
    const zones = clinicTimeZones('Asia/Kolkata');
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toEqual([...zones].sort((left, right) => left.localeCompare(right)));
  });

  it('names a curated zone for search', () => {
    expect(curatedTimeZoneName('Asia/Kolkata')).toBe('India (Kolkata)');
    expect(curatedTimeZoneName('Asia/Calcutta')).toBeUndefined();
  });
});
