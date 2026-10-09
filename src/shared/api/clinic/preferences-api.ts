import { z } from 'zod';

import { api, type ApiBody, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  type PatientFileSection,
  type Section,
  SECTION_VALUES,
  type Theme,
  themeSchema,
} from './clinic-schema.ts';

/** A patient-file pin: a contract section, or the Visits tab the plan adds (D26, Appendix F). */
export type PatientFilePin = PatientFileSection | 'visits';

/**
 * The member's clinic preferences (D32: per member, on the server —
 * `/app/memberships/me/preferences`), keyed by the session.
 */
export interface ClinicPreferences {
  /** Pinned rooms in pin order (the header tabs and the phone tab bar). */
  pinnedSections: Section[];
  /** Branch picker selection; empty = all branches. */
  branchFilter: string[];
  theme: Theme;
  patientFilePins: PatientFilePin[];
  /** `<picker key>:<record id>` — ids, never names or phones (§7.2 privacy). */
  recentPicks: string[];
}

/** What a user starts with (H:4079 pins, D26 file pins, all branches, light). */
export const DEFAULT_CLINIC_PREFERENCES: Readonly<ClinicPreferences> = {
  pinnedSections: ['appointments', 'leads', 'patients', 'payments'],
  branchFilter: [],
  theme: 'light',
  patientFilePins: ['overview', 'visits', 'prescriptions', 'invoices'],
  recentPicks: [],
};

/** TanStack Query keys for the preferences record. */
export const preferencesQueryKeys = {
  all: ['clinic', 'preferences'] as const,
  /** The member's record in one organization. */
  mine: (organizationId: string | null) =>
    [...preferencesQueryKeys.all, 'mine', organizationId] as const,
};

/** The record as `GET` / `PATCH /app/memberships/me/preferences` types it. */
type ApiPreferences = NonNullable<ApiData<'/app/memberships/me/preferences', 'get'>>;
type ApiPreferencesChange = NonNullable<
  ApiBody<'/app/memberships/me/preferences', 'patch'>
>;

/** The rooms a member can pin, as the API names them (its `contacts` and `activity` have no room here). */
const API_PINNED_SECTIONS = [
  'today',
  'contacts',
  'activity',
  'leads',
  'appointments',
  'patients',
  'medical',
  'stock',
  'payments',
  'tasks',
  'offerings',
  'users',
] as const;

/** The patient file's sections, as the API names them. */
const API_FILE_PINS = [
  'overview',
  'activity',
  'clinical_notes',
  'appointments',
  'prescriptions',
  'treatments',
  'images',
  'reports',
  'packages',
  'invoices',
  'payments',
] as const;
type ApiFilePin = (typeof API_FILE_PINS)[number];

const preferencesWire = wireSchema<ApiPreferences>()(
  z.object({
    pinned_sections: z.array(z.enum(API_PINNED_SECTIONS)),
    theme: themeSchema,
    branch_ids: z.array(z.string()),
    patient_file_pins: z.array(z.enum(API_FILE_PINS)),
    recent_picks: z.array(z.string()),
  }),
);

/**
 * The file's tabs and the API's sections: the Overview tab is the API's `overview`, Clinical notes
 * (the `overview` folder) its `clinical_notes`, Visits its `appointments`. Team notes has no API
 * section (route map §4 #3), and the API's `activity` no tab here.
 */
const FILE_PIN_TO_API: Readonly<Partial<Record<PatientFilePin, ApiFilePin>>> = {
  timeline: 'overview',
  overview: 'clinical_notes',
  visits: 'appointments',
  prescriptions: 'prescriptions',
  treatments: 'treatments',
  images: 'images',
  reports: 'reports',
  packages: 'packages',
  invoices: 'invoices',
  payments: 'payments',
};

const FILE_PIN_FROM_API = new Map<ApiFilePin, PatientFilePin>(
  Object.entries(FILE_PIN_TO_API).map(([pin, api]) => [api, pin as PatientFilePin]),
);

/** A recent pick the API keeps: `room:field:value` (a picker key is `room:field`). */
const RECENT_PICK = /^[^:]+:[^:]+:.+$/;

const isSection = (value: string): value is Section =>
  (SECTION_VALUES as readonly string[]).includes(value);

/** The record as the shell reads it. */
function toPreferences(row: z.output<typeof preferencesWire>): ClinicPreferences {
  return {
    pinnedSections: row.pinned_sections.filter(isSection),
    branchFilter: row.branch_ids,
    theme: row.theme,
    patientFilePins: row.patient_file_pins.flatMap((pin) => {
      const tab = FILE_PIN_FROM_API.get(pin);
      return tab ? [tab] : [];
    }),
    recentPicks: row.recent_picks,
  };
}

/** A change as the API takes it: only the fields it names, each list replacing the saved one. */
function toPreferencesChange(patch: Partial<ClinicPreferences>): ApiPreferencesChange {
  const change: ApiPreferencesChange = {};
  if (patch.pinnedSections) change.pinned_sections = patch.pinnedSections;
  if (patch.branchFilter) change.branch_ids = patch.branchFilter;
  if (patch.theme) change.theme = patch.theme;
  if (patch.patientFilePins) {
    change.patient_file_pins = patch.patientFilePins.flatMap((pin) => {
      const api = FILE_PIN_TO_API[pin];
      return api ? [api] : [];
    });
  }
  if (patch.recentPicks) {
    change.recent_picks = patch.recentPicks.filter((pick) => RECENT_PICK.test(pick));
  }
  return change;
}

/** Read the member's preferences — the server's defaults until their first save. */
export async function fetchMyPreferences(): Promise<ClinicPreferences> {
  const response = await api.get('/app/memberships/me/preferences');
  return toPreferences(preferencesWire.parse(response.data));
}

/**
 * Save a change to the member's preferences (`PATCH`, silent — no stale check: the screens save
 * as the member clicks and retry, and the last save wins).
 */
export async function saveMyPreferences(
  patch: Partial<ClinicPreferences>,
): Promise<ClinicPreferences> {
  const response = await api.patch('/app/memberships/me/preferences', {
    body: toPreferencesChange(patch),
  });
  return toPreferences(preferencesWire.parse(response.data));
}

const RECENT_PER_PICKER = 3;
const RECENT_MAX = 60;

/** The ids most recently picked in one picker, newest first. */
export function recentPicksFor(
  recentPicks: readonly string[],
  pickerKey: string,
): string[] {
  const prefix = `${pickerKey}:`;
  return recentPicks
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => entry.slice(prefix.length));
}

/** `recentPicks` after picking `id` in `pickerKey`: newest first, 3 per picker, 60 in all. */
export function withRecentPick(
  recentPicks: readonly string[],
  pickerKey: string,
  id: string,
): string[] {
  const entry = `${pickerKey}:${id}`;
  const others = recentPicks.filter((existing) => existing !== entry);
  const samePicker = others.filter((existing) => existing.startsWith(`${pickerKey}:`));
  const dropped = new Set(samePicker.slice(RECENT_PER_PICKER - 1));
  return [entry, ...others.filter((existing) => !dropped.has(existing))].slice(
    0,
    RECENT_MAX,
  );
}
