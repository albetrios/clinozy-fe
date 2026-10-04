/**
 * The read Medical › Medicines makes from the URL (KICKOFF §6.7, `S:53`). Kept
 * out of `medical.search.ts`, which rides the entry chunk; this module loads
 * with the tab.
 */
import type { MedicineListParams } from '@/shared/api/clinic/medicines-contracts.ts';

import type { MedicalSearch } from '../medical.search.ts';
import { sortParamsOf } from '../shared/medical-params.ts';

/** The list read's params for the URL as it stands — what the tab hands `useMedicineList`. */
export function medicineParamsOf(search: MedicalSearch): MedicineListParams {
  return {
    q: search.q,
    stock: search.stock,
    expiry: search.expiry,
    manufacturer: search.manufacturer,
    created: search.created,
    ...sortParamsOf(search.sort, [
      'seq',
      'name',
      'manufacturer',
      'stock',
      'mrp',
      'margin',
    ] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function medicineFilterKey(params: MedicineListParams): string {
  return JSON.stringify([
    params.q,
    params.stock,
    params.expiry,
    params.manufacturer,
    params.created,
  ]);
}
