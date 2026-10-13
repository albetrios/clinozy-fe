/**
 * URL search-param schemas for the Patients room (consumed by routeTree's
 * `validateSearch`): the list's view, search, filters and sort as clinozy-be
 * reads them (api-integration §5.4). A value the URL can't hold — an unknown
 * type, a bad date range, a view or a filter the API has no read for — is
 * dropped, never an error. Defaults stay out of the URL (`/patients` is the
 * All view, newest first). New patient's prefill is
 * `patients.dialog-search.ts`'s, off the entry chunk.
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod. The test pins
 * each list to the contract's enum.
 */
import { listIn, oneOf, queryOf, sortOf } from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from '@/shared/api/app/app-list-filters.ts';
import type {
  PatientConversion,
  PatientStatus,
  PatientType,
} from '@/shared/api/app/app-schema.ts';
import type { PatientSortKey, PatientView } from '@/shared/api/app/patients-contracts.ts';

/**
 * The list's views, in the tab order (`patients.md:203–207`) — less In clinic today and With
 * dues, which the API cannot read (G4, Q22).
 */
export const PATIENT_VIEWS = [
  'all',
  'follow',
  'recall',
] as const satisfies readonly PatientView[];

/**
 * Each filter's values, in the chip order of its column (`patients.md:28`) — less Gender, the
 * person's and not a patients filter (G4).
 */
export const PATIENT_FILTER_VALUES = {
  types: ['aesthetic', 'clinical', 'lhr', 'dental', 'physio', 'gynac'],
  status: ['new', 'regular', 'vip', 'inactive'],
  conversion: ['converted', 'not_converted'],
} as const satisfies {
  types: readonly PatientType[];
  status: readonly PatientStatus[];
  conversion: readonly PatientConversion[];
};

/** The columns the API sorts by: ID and Follow-up. */
const SORT_KEYS = ['seq', 'followUp'] as const satisfies readonly PatientSortKey[];

/** A column sort in the URL: `seq:desc`, `followUp:asc` (the shared table's form). */
export type PatientsSort = `${PatientSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for `/patients` and its dialog route. */
export interface PatientsSearch {
  /** All (default) · Follow-up due · Recall. */
  view?: PatientView;
  /** Name, mobile or "#ID" (≤ 80 characters, the API's `q`). */
  q?: string;
  /** Any of these patient types. */
  types?: PatientType[];
  /** One status. */
  status?: PatientStatus;
  /** One conversion. */
  conversion?: PatientConversion;
  created?: CreatedFilter;
  /** A follow-up range — every preset but "Not set", which the API cannot read. */
  followUp?: Exclude<FollowUpFilter, 'not_set'>;
  sort?: PatientsSort;
}

/** The list's state when the URL says nothing. */
export const PATIENTS_SEARCH_DEFAULTS = { view: 'all' } as const satisfies PatientsSearch;

/** A Follow-up filter the API can read — every preset but "Not set", or a range. */
function readPatientFollowUp(value: unknown): PatientsSearch['followUp'] {
  const filter = readFollowUpFilter(value);
  return filter === 'not_set' ? undefined : filter;
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
    status: oneOf(PATIENT_FILTER_VALUES.status, search.status),
    conversion: oneOf(PATIENT_FILTER_VALUES.conversion, search.conversion),
    created: readCreatedFilter(search.created),
    followUp: readPatientFollowUp(search.followUp),
    sort: sortOf(SORT_KEYS, search.sort),
  };
}
