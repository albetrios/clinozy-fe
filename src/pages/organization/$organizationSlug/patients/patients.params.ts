/**
 * The read the room's list makes from the page's URL (KICKOFF §6.5). Kept out
 * of `patients.search.ts` on purpose — `routeTree.tsx` (the entry chunk)
 * imports that module for `validateSearch`, so anything else exported from it
 * that the room uses ships on the first paint; this module loads with the room.
 */
import type {
  PatientListParams,
  PatientSortKey,
} from '@/shared/api/app/patients-contracts.ts';

import { PATIENTS_SEARCH_DEFAULTS, type PatientsSearch } from './patients.search.ts';

/** The list read's params for the URL as it stands (defaults applied) — what the room hands `usePatientList`. */
export function patientListParamsOf(search: PatientsSearch): PatientListParams {
  const [sort, order] = (search.sort?.split(':') ?? []) as [
    PatientSortKey?,
    ('asc' | 'desc')?,
  ];
  return {
    view: search.view ?? PATIENTS_SEARCH_DEFAULTS.view,
    q: search.q,
    types: search.types,
    status: search.status,
    conversion: search.conversion,
    age: search.age,
    created: search.created,
    followUp: search.followUp,
    sort,
    order,
  };
}
