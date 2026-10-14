/**
 * The read Medical › Manufacturers makes from the URL (KICKOFF §6.7, `S:64`).
 * Kept out of `medical.search.ts`, which rides the entry chunk; this module
 * loads with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { MedicalSearch } from '../medical.search.ts';
import type { ManufacturerListParams } from '../shared/medical-contracts.ts';

/**
 * The list read's params for the URL as it stands — what the tab hands `useManufacturerList`: the
 * search, one supplier and one MR (the API filters by one of each), Created and the sort.
 */
export function manufacturerParamsOf(search: MedicalSearch): ManufacturerListParams {
  return {
    q: search.q,
    supplier: search.suppliers?.[0],
    mr: search.mrs?.[0],
    created: search.created,
    ...sortParamsOf(search.sort, ['name'] as const),
  };
}

/** The params the footer reads — the filters alone: a sort changes no count. */
export function manufacturerSummaryParamsOf({
  q,
  supplier,
  mr,
  created,
}: ManufacturerListParams): ManufacturerListParams {
  return { q, supplier, mr, created };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function manufacturerFilterKey(params: ManufacturerListParams): string {
  return JSON.stringify([params.q, params.supplier, params.mr, params.created]);
}
