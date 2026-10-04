/**
 * The read Medical › Suppliers makes from the URL (KICKOFF §6.7, `S:61`). Kept
 * out of `medical.search.ts`, which rides the entry chunk; this module loads
 * with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { MedicalSearch } from '../medical.search.ts';
import type { SupplierListParams } from '../shared/medical-contracts.ts';

/** The list read's params for the URL as it stands — what the tab hands `useSupplierList`. */
export function supplierParamsOf(search: MedicalSearch): SupplierListParams {
  return {
    q: search.q,
    manufacturer: search.manufacturer,
    created: search.created,
    ...sortParamsOf(search.sort, ['name', 'payable'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function supplierFilterKey(params: SupplierListParams): string {
  return JSON.stringify([params.q, params.manufacturer, params.created]);
}
