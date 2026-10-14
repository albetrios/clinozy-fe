import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import { type OfferingSpecialty, offeringSpecialtySchema } from './app-schema.ts';

/*
 * The clinic's own values that setup and Settings › Clinic read and save (feat-clinic-setup
 * KICKOFF §5, §6.6; RC-20…RC-23): its specialties and timezone on the organization
 * (`GET`/`PATCH /tenancy/organization`), and the reminder hour, lead hold and retarget days on its
 * settings (`GET`/`PATCH /tenancy/organization/settings`). The cash-drawer float is never read or
 * sent (D17).
 */

/** TanStack Query keys for the clinic's own values, each carrying the organization. */
export const clinicQueryKeys = {
  all: ['app', 'clinic'] as const,
  profile: (organizationId: string | null) =>
    [...clinicQueryKeys.all, organizationId, 'profile'] as const,
  settings: (organizationId: string | null) =>
    [...clinicQueryKeys.all, organizationId, 'settings'] as const,
};

type ApiOrganization = NonNullable<ApiData<'/tenancy/organization', 'get'>>;

const clinicProfileWire = wireSchema<ApiOrganization>()(
  z.object({
    name: z.string(),
    specialties: z.array(offeringSpecialtySchema),
    timezone: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** The clinic as setup and Settings › Clinic read it. */
export interface ClinicProfile {
  name: string;
  /** The first is the clinic's main specialty (a new offering's default, Q-O6). */
  specialties: OfferingSpecialty[];
  /** IANA name (`Asia/Kolkata`). */
  timezone: string;
  /** When the clinic was created — the first-booking event's "minutes since" (KICKOFF §6.8). */
  createdAt: string;
  updatedAt: string;
}

/** A change to the clinic's specialties or timezone — only what is sent changes. */
export interface ClinicProfileChange {
  specialties?: OfferingSpecialty[];
  timezone?: string;
}

function toClinicProfile(row: z.output<typeof clinicProfileWire>): ClinicProfile {
  return {
    name: row.name,
    specialties: row.specialties,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The clinic's name, specialties and timezone — `GET /tenancy/organization` (RC-20). */
export async function fetchClinicProfile(): Promise<ClinicProfile> {
  const response = await api.get('/tenancy/organization');
  return toClinicProfile(clinicProfileWire.parse(response.data));
}

/** Saves the clinic's specialties and/or timezone — `PATCH /tenancy/organization` (RC-21). */
export async function updateClinicProfile({
  change,
  idempotencyKey,
}: {
  change: ClinicProfileChange;
  idempotencyKey: string;
}): Promise<ClinicProfile> {
  const response = await api.patch('/tenancy/organization', {
    body: {
      ...(change.specialties ? { specialties: change.specialties } : {}),
      ...(change.timezone ? { timezone: change.timezone } : {}),
    },
    idempotencyKey,
  });
  return toClinicProfile(clinicProfileWire.parse(response.data));
}

type ApiOrganizationSettings = NonNullable<
  ApiData<'/tenancy/organization/settings', 'get'>
>;

const clinicSettingsWire = wireSchema<ApiOrganizationSettings>()(
  z.object({
    reminder_hour: z.number().int(),
    lead_hold_days: z.number().int(),
    retarget_after_days: z.number().int(),
    updated_at: z.string(),
  }),
);

/** clinozy-be's defaults for the clinic's operating values (launch D34, D35, D38). */
export const CLINIC_SETTINGS_DEFAULTS = {
  reminderHour: 16,
  leadHoldDays: 3,
  retargetAfterDays: 90,
} as const;

/**
 * clinozy-be's limits on the operating values (`organization-settings.dto.ts`: `reminder_hour`
 * 0–23, `lead_hold_days` 1–30, `retarget_after_days` 7–730). The steppers stop at them; the
 * server's 400 still maps onto the field if they ever drift.
 */
export const CLINIC_SETTINGS_LIMITS = {
  reminderHour: { min: 0, max: 23 },
  leadHoldDays: { min: 1, max: 30 },
  retargetAfterDays: { min: 7, max: 730 },
} as const;

/** The operating values Settings › Clinic shows, each with its default. */
export interface ClinicSettings {
  /** 0–23, clinic-local: when the day-before booking reminders go. */
  reminderHour: number;
  /** How long a lead is held for its owner. */
  leadHoldDays: number;
  /** When a quiet patient is offered back as a lead. */
  retargetAfterDays: number;
  updatedAt: string;
}

/** A change to the operating values — only what is sent changes. */
export type ClinicSettingsChange = Partial<Omit<ClinicSettings, 'updatedAt'>>;

function toClinicSettings(row: z.output<typeof clinicSettingsWire>): ClinicSettings {
  return {
    reminderHour: row.reminder_hour,
    leadHoldDays: row.lead_hold_days,
    retargetAfterDays: row.retarget_after_days,
    updatedAt: row.updated_at,
  };
}

/** The clinic's operating values — `GET /tenancy/organization/settings` (RC-22). */
export async function fetchClinicSettings(): Promise<ClinicSettings> {
  const response = await api.get('/tenancy/organization/settings');
  return toClinicSettings(clinicSettingsWire.parse(response.data));
}

/** Saves the clinic's operating values — `PATCH /tenancy/organization/settings` (RC-23). */
export async function updateClinicSettings({
  change,
  idempotencyKey,
}: {
  change: ClinicSettingsChange;
  idempotencyKey: string;
}): Promise<ClinicSettings> {
  const response = await api.patch('/tenancy/organization/settings', {
    body: {
      ...(change.reminderHour === undefined
        ? {}
        : { reminder_hour: change.reminderHour }),
      ...(change.leadHoldDays === undefined
        ? {}
        : { lead_hold_days: change.leadHoldDays }),
      ...(change.retargetAfterDays === undefined
        ? {}
        : { retarget_after_days: change.retargetAfterDays }),
    },
    idempotencyKey,
  });
  return toClinicSettings(clinicSettingsWire.parse(response.data));
}
