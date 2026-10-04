/**
 * The read Medical › MRs makes from the URL (KICKOFF §6.7, `S:67`). Kept out of
 * `medical.search.ts`, which rides the entry chunk; this module loads with the
 * tab.
 */
import type { MedicalSearch } from '../medical.search.ts';
import type { MrListParams } from '../shared/medical-contracts.ts';
import { sortParamsOf } from '../shared/medical-params.ts';

/** The list read's params for the URL as it stands — what the tab hands `useMrList`. */
export function mrParamsOf(search: MedicalSearch): MrListParams {
  return {
    q: search.q,
    created: search.created,
    ...sortParamsOf(search.sort, ['name'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function mrFilterKey(params: MrListParams): string {
  return JSON.stringify([params.q, params.created]);
}
