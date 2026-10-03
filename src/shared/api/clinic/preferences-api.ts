import type { PatientFileSection, Section, Theme } from './clinic-schema.ts';

/** A patient-file pin: a contract section, or the Visits tab the plan adds (D26, Appendix F). */
export type PatientFilePin = PatientFileSection | 'visits';

/**
 * The signed-in user's clinic preferences — the contract's `UserPreference`
 * (D32: per user, on the server), keyed by the session rather than a userId.
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
  mine: () => [...preferencesQueryKeys.all, 'mine'] as const,
};

// REPLACE_WITH_API: the record lives on clinozy-be (`getSession` /
// `updatePreference`, schema-routes.md › Shell); until then, this session.
let stored: ClinicPreferences | null = null;

/** Read the user's preferences. REPLACE_WITH_API: part of `getSession`. */
export async function fetchMyPreferences(): Promise<ClinicPreferences> {
  return structuredClone(stored ?? DEFAULT_CLINIC_PREFERENCES);
}

/** Merge a change into the user's preferences. REPLACE_WITH_API: `updatePreference`. */
export async function saveMyPreferences(
  patch: Partial<ClinicPreferences>,
): Promise<ClinicPreferences> {
  stored = { ...(stored ?? structuredClone(DEFAULT_CLINIC_PREFERENCES)), ...patch };
  return structuredClone(stored);
}

/** Forget the fixture record (tests). */
export function resetPreferencesFixture(): void {
  stored = null;
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
