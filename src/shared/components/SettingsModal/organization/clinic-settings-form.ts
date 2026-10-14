import { z } from 'zod';

import { TIME_ZONE_LIST } from '@/lib/i18n/locale.constants.ts';
import {
  type OfferingSpecialty,
  offeringSpecialtySchema,
} from '@/shared/api/app/app-schema.ts';
import {
  CLINIC_SETTINGS_LIMITS,
  type ClinicProfile,
  type ClinicProfileChange,
  type ClinicSettings,
  type ClinicSettingsChange,
} from '@/shared/api/app/clinic-api.ts';

/*
 * The two forms of Settings › Clinic (feat-clinic-setup KICKOFF §6.6): the clinic's specialties
 * and timezone (`PATCH /tenancy/organization`) and its operating values
 * (`PATCH /tenancy/organization/settings`). Pure — values, schemas, the change each save sends
 * and the timezone list — so the panel stays layout.
 */

/** The specialties-and-timezone form. Field names match the API's (`specialties`, `timezone`). */
export interface ClinicProfileValues {
  /** In pick order: the first is the clinic's main specialty (Q-O6). */
  specialties: OfferingSpecialty[];
  timezone: string;
}

/** The operating-values form. Field names are the API's in camelCase (`reminder_hour` → `reminderHour`). */
export interface ClinicSettingsValues {
  reminderHour: number;
  leadHoldDays: number;
  retargetAfterDays: number;
}

/** The profile form's starting values. */
export function clinicProfileValues(profile: ClinicProfile): ClinicProfileValues {
  return { specialties: [...profile.specialties], timezone: profile.timezone };
}

/** The operating-values form's starting values. */
export function clinicSettingsValues(settings: ClinicSettings): ClinicSettingsValues {
  return {
    reminderHour: settings.reminderHour,
    leadHoldDays: settings.leadHoldDays,
    retargetAfterDays: settings.retargetAfterDays,
  };
}

/** The profile form's client check: at least one specialty, a timezone. */
export function clinicProfileSchema(messages: {
  specialtiesRequired: string;
  timezoneRequired: string;
}) {
  return z.object({
    specialties: z.array(offeringSpecialtySchema).min(1, messages.specialtiesRequired),
    timezone: z.string().trim().min(1, messages.timezoneRequired),
  });
}

/** The operating-values form's client check: whole numbers within clinozy-be's limits. */
export function clinicSettingsSchema(
  rangeMessage: (limits: { min: number; max: number }) => string,
) {
  const inRange = (limits: { min: number; max: number }) =>
    z
      .number()
      .int()
      .min(limits.min, rangeMessage(limits))
      .max(limits.max, rangeMessage(limits));
  return z.object({
    reminderHour: inRange(CLINIC_SETTINGS_LIMITS.reminderHour),
    leadHoldDays: inRange(CLINIC_SETTINGS_LIMITS.leadHoldDays),
    retargetAfterDays: inRange(CLINIC_SETTINGS_LIMITS.retargetAfterDays),
  });
}

function sameList<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

/**
 * What the profile save sends: only the values that differ from the saved ones, so a stale
 * value never overwrites what another admin saved. The specialties' order counts — the first is
 * the main one.
 */
export function clinicProfileChange(
  saved: ClinicProfileValues,
  next: ClinicProfileValues,
): ClinicProfileChange {
  const timezone = next.timezone.trim();
  return {
    ...(sameList(saved.specialties, next.specialties)
      ? {}
      : { specialties: next.specialties }),
    ...(saved.timezone === timezone ? {} : { timezone }),
  };
}

/** What the operating-values save sends: only the values that differ from the saved ones. */
export function clinicSettingsChange(
  saved: ClinicSettingsValues,
  next: ClinicSettingsValues,
): ClinicSettingsChange {
  return {
    ...(saved.reminderHour === next.reminderHour
      ? {}
      : { reminderHour: next.reminderHour }),
    ...(saved.leadHoldDays === next.leadHoldDays
      ? {}
      : { leadHoldDays: next.leadHoldDays }),
    ...(saved.retargetAfterDays === next.retargetAfterDays
      ? {}
      : { retargetAfterDays: next.retargetAfterDays }),
  };
}

/** Whether a change carries anything to send. */
export function hasClinicChange(
  change: ClinicProfileChange | ClinicSettingsChange,
): boolean {
  return Object.keys(change).length > 0;
}

/** Every IANA zone this runtime knows (`Intl.supportedValuesOf`), or none where it cannot say. */
function runtimeTimeZones(): readonly string[] {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [];
}

/**
 * The timezones the clinic can pick, sorted: the runtime's IANA list, the app's curated zones
 * (`TIME_ZONE_LIST` — it carries `Asia/Kolkata` and `UTC`, which V8 lists only under their
 * canonical names `Asia/Calcutta` and `Etc/UTC`) and the clinic's current zone, always present
 * whatever this runtime lists.
 */
export function clinicTimeZones(current: string): string[] {
  const zones = new Set<string>(runtimeTimeZones());
  for (const entry of TIME_ZONE_LIST) {
    if (entry.id !== 'auto') zones.add(entry.id);
  }
  if (current.trim() !== '') zones.add(current);
  return [...zones].sort((left, right) => left.localeCompare(right));
}

/** The curated name of a zone ("India (Kolkata)"), for search — undefined when it has none. */
export function curatedTimeZoneName(zone: string): string | undefined {
  return TIME_ZONE_LIST.find((entry) => entry.id === zone)?.label;
}
