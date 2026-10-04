/**
 * URL search-param schemas for the Patients room (consumed by routeTree's
 * `validateSearch`): the list's view, search, filters and sort (KICKOFF §6.5,
 * `S:30`), and the New patient prefill on `create/` (`S:31`). A value the URL
 * can't hold — an unknown type, a bad date range — is dropped, never an error.
 * Defaults stay out of the URL (`/patients` is the All view, newest first).
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod. The test pins
 * each list to the contract's enum.
 */
import {
  listOf,
  oneOf,
  queryOf,
  RECORD_ID,
  sortOf,
  textOf,
} from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import type {
  Gender,
  PatientConversion,
  PatientStatus,
  PatientType,
} from '@/shared/api/clinic/clinic-schema.ts';
import type {
  PatientSortKey,
  PatientView,
} from '@/shared/api/clinic/patients-contracts.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';

/** The list's views, in the tab order (`patients.md:203–207`). */
export const PATIENT_VIEWS = [
  'all',
  'today',
  'dues',
  'follow',
  'recall',
] as const satisfies readonly PatientView[];

/** Each filter's values, in the chip order of its column (`patients.md:28`). */
export const PATIENT_FILTER_VALUES = {
  gender: ['female', 'male', 'other'],
  types: ['aesthetic', 'clinical', 'lhr', 'dental', 'physio', 'gynac'],
  status: ['new', 'regular', 'vip', 'inactive'],
  conversion: ['converted', 'not_converted'],
} as const satisfies {
  gender: readonly Gender[];
  types: readonly PatientType[];
  status: readonly PatientStatus[];
  conversion: readonly PatientConversion[];
};

const SORT_KEYS = [
  'seq',
  'name',
  'types',
  'status',
  'conversion',
  'age',
  'followUp',
  'due',
  'updated',
] as const satisfies readonly PatientSortKey[];

/** A column sort in the URL: `due:desc`, `name:asc` (the shared table's form). */
export type PatientsSort = `${PatientSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for `/patients` and its dialog route. */
export interface PatientsSearch {
  /** All (default) · In clinic today · With dues · Follow-up due · Recall. */
  view?: PatientView;
  /** Name, mobile or "#ID" (≤ 80 characters, the contract's `q`). */
  q?: string;
  /** Any of these patient types. */
  types?: PatientType[];
  /** Any of these statuses. */
  status?: PatientStatus[];
  /** Any of these genders (a backend request, Appendix F). */
  gender?: Gender[];
  /** Either conversion (a backend request, Appendix F). */
  conversion?: PatientConversion[];
  created?: CreatedFilter;
  followUp?: FollowUpFilter;
  sort?: PatientsSort;
}

/** The list's state when the URL says nothing. */
export const PATIENTS_SEARCH_DEFAULTS = { view: 'all' } as const satisfies PatientsSearch;

/** Keep the entries of a URL list that `values` names. */
function listIn<T extends string>(values: readonly T[], value: unknown): T[] | undefined {
  return listOf<T>(value, (entry) => oneOf(values, entry) !== undefined);
}

/**
 * Parse `/patients` search params. Every key is answered, `undefined` included:
 * the router keeps a raw value the schema omits, so dropping one means saying so.
 */
export function validatePatientsSearch(search: Record<string, unknown>): PatientsSearch {
  return {
    view: oneOf(PATIENT_VIEWS, search.view),
    q: queryOf(search.q, 80),
    types: listIn(PATIENT_FILTER_VALUES.types, search.types),
    status: listIn(PATIENT_FILTER_VALUES.status, search.status),
    gender: listIn(PATIENT_FILTER_VALUES.gender, search.gender),
    conversion: listIn(PATIENT_FILTER_VALUES.conversion, search.conversion),
    created: readCreatedFilter(search.created),
    followUp: readFollowUpFilter(search.followUp),
    sort: sortOf(SORT_KEYS, search.sort),
  };
}

/** The New patient prefill (`S:31`; ⌘K "New patient", the contact card's "+ Patient"). */
export interface PatientCreateSearch {
  /** The person's name, as given (≤ 120 characters): the first word fills First name, the rest Last name. */
  name?: string;
  /** Their mobile, E.164 — a typed or pasted 10-digit Indian mobile. */
  phone?: string;
  /** The lead the patient comes from — sets `Patient.leadId` (`S:317`). */
  fromLead?: string;
}

/**
 * Parse the `/patients/create` prefill. `name` and `phone` are personal data:
 * the telemetry scrub filters both from every captured URL
 * (`SENSITIVE_QUERY_PARAMS`).
 */
export function validatePatientCreateSearch(
  search: Record<string, unknown>,
): PatientCreateSearch {
  const name = textOf(search.name);
  const phone = textOf(search.phone);
  const fromLead = textOf(search.fromLead);
  return {
    name: name && name.length <= 120 ? name : undefined,
    phone: (phone && toClinicPhone(phone)) || undefined,
    fromLead: RECORD_ID.test(fromLead) ? fromLead : undefined,
  };
}
