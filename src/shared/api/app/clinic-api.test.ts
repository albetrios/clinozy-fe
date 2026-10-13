import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  CLINIC_SETTINGS_DEFAULTS,
  clinicQueryKeys,
  fetchClinicProfile,
  fetchClinicSettings,
  updateClinicProfile,
  updateClinicSettings,
} from './clinic-api.ts';

/** `GET /tenancy/organization` — the fields the clinic reads, among the rest. */
const organizationRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'org_acmeaaaaaaaaaaaaaaaaa',
  name: 'Acme Skin Clinic',
  slug: 'acme',
  specialties: ['skin', 'hair'],
  timezone: 'Asia/Kolkata',
  created_at: '2026-10-01T04:30:00Z',
  updated_at: '2026-10-13T04:30:00Z',
  ...overrides,
});

/** `GET /tenancy/organization/settings`. */
const settingsRow = (overrides: Record<string, unknown> = {}) => ({
  reminder_hour: 16,
  lead_hold_days: 3,
  retarget_after_days: 90,
  updated_at: '2026-10-13T04:30:00Z',
  ...overrides,
});

const answer = (data: unknown) => ({ data, meta: { request_id: 'req_1' } }) as never;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('clinicQueryKeys', () => {
  it('carries the organization', () => {
    expect(clinicQueryKeys.profile('org_a')).toEqual([
      'app',
      'clinic',
      'org_a',
      'profile',
    ]);
    expect(clinicQueryKeys.settings('org_a')).toEqual([
      'app',
      'clinic',
      'org_a',
      'settings',
    ]);
  });
});

describe('the clinic’s profile', () => {
  it('reads its name, specialties and timezone', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(answer(organizationRow()));

    expect(await fetchClinicProfile()).toEqual({
      name: 'Acme Skin Clinic',
      specialties: ['skin', 'hair'],
      timezone: 'Asia/Kolkata',
      createdAt: '2026-10-01T04:30:00Z',
      updatedAt: '2026-10-13T04:30:00Z',
    });
    expect(api.get).toHaveBeenCalledWith('/tenancy/organization');
  });

  it('refuses a specialty it does not know', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      answer(organizationRow({ specialties: ['eyes'] })),
    );
    await expect(fetchClinicProfile()).rejects.toThrow();
  });

  it('sends only the specialties when only they change', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(
      answer(organizationRow({ specialties: ['dental'] })),
    );

    const profile = await updateClinicProfile({
      change: { specialties: ['dental'] },
      idempotencyKey: 'key-1',
    });

    expect(api.patch).toHaveBeenCalledWith('/tenancy/organization', {
      body: { specialties: ['dental'] },
      idempotencyKey: 'key-1',
    });
    expect(profile.specialties).toEqual(['dental']);
  });

  it('sends only the timezone when only it changes', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(
      answer(organizationRow({ timezone: 'Asia/Dubai' })),
    );

    await updateClinicProfile({
      change: { timezone: 'Asia/Dubai' },
      idempotencyKey: 'key-2',
    });

    expect(api.patch).toHaveBeenCalledWith('/tenancy/organization', {
      body: { timezone: 'Asia/Dubai' },
      idempotencyKey: 'key-2',
    });
  });
});

describe('the clinic’s operating values', () => {
  it('reads the reminder hour, lead hold and retarget days', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(answer(settingsRow({ reminder_hour: 9 })));

    expect(await fetchClinicSettings()).toEqual({
      reminderHour: 9,
      leadHoldDays: 3,
      retargetAfterDays: 90,
      updatedAt: '2026-10-13T04:30:00Z',
    });
    expect(api.get).toHaveBeenCalledWith('/tenancy/organization/settings');
  });

  it('matches clinozy-be’s defaults', () => {
    expect(CLINIC_SETTINGS_DEFAULTS).toEqual({
      reminderHour: 16,
      leadHoldDays: 3,
      retargetAfterDays: 90,
    });
  });

  it('sends only the values that change — a zero is sent', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(answer(settingsRow({ reminder_hour: 0 })));

    const settings = await updateClinicSettings({
      change: { reminderHour: 0 },
      idempotencyKey: 'key-3',
    });

    expect(api.patch).toHaveBeenCalledWith('/tenancy/organization/settings', {
      body: { reminder_hour: 0 },
      idempotencyKey: 'key-3',
    });
    expect(settings.reminderHour).toBe(0);
  });

  it('sends every value given, in snake_case', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(
      answer(settingsRow({ lead_hold_days: 5, retarget_after_days: 120 })),
    );

    await updateClinicSettings({
      change: { leadHoldDays: 5, retargetAfterDays: 120 },
      idempotencyKey: 'key-4',
    });

    expect(api.patch).toHaveBeenCalledWith('/tenancy/organization/settings', {
      body: { lead_hold_days: 5, retarget_after_days: 120 },
      idempotencyKey: 'key-4',
    });
  });
});
