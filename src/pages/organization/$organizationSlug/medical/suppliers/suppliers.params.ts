/**
 * The read Medical › Suppliers makes from the URL (KICKOFF §6.7, `S:61`). Kept
 * out of `medical.search.ts`, which rides the entry chunk; this module loads
 * with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { MedicalSearch } from '../medical.search.ts';
import type { SupplierListParams } from '../shared/medical-contracts.ts';

/**
 * The list read's params for the URL as it stands — what the tab hands `useSupplierList`: the
 * search, one manufacturer (the API filters by one), "owed something", Created and the sort.
 */
export function supplierParamsOf(search: MedicalSearch): SupplierListParams {
  return {
    q: search.q,
    manufacturer: search.manufacturer?.[0],
    hasPayable: search.payable === 'owed' ? true : undefined,
    created: search.created,
    ...sortParamsOf(search.sort, ['name', 'payable'] as const),
  };
}

/**
 * The params the footer reads — the filters alone: a sort changes neither the count nor the
 * payable.
 */
export function supplierSummaryParamsOf({
  q,
  manufacturer,
  hasPayable,
  created,
}: SupplierListParams): SupplierListParams {
  return { q, manufacturer, hasPayable, created };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function supplierFilterKey(params: SupplierListParams): string {
  return JSON.stringify([
    params.q,
    params.manufacturer,
    params.hasPayable,
    params.created,
  ]);
}
