/**
 * The read Medical › Manufacturers makes from the URL (KICKOFF §6.7, `S:64`).
 * Kept out of `medical.search.ts`, which rides the entry chunk; this module
 * loads with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { MedicalSearch } from '../medical.search.ts';
import type { ManufacturerListParams } from '../shared/medical-contracts.ts';

/** The list read's params for the URL as it stands — what the tab hands `useManufacturerList`. */
export function manufacturerParamsOf(search: MedicalSearch): ManufacturerListParams {
  return {
    q: search.q,
    suppliers: search.suppliers,
    mrs: search.mrs,
    created: search.created,
    ...sortParamsOf(search.sort, ['name'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function manufacturerFilterKey(params: ManufacturerListParams): string {
  return JSON.stringify([params.q, params.suppliers, params.mrs, params.created]);
}
