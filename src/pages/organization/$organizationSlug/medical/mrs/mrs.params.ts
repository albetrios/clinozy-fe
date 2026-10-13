/**
 * The read Medical › MRs makes from the URL (KICKOFF §6.7, `S:67`). Kept out of
 * `medical.search.ts`, which rides the entry chunk; this module loads with the
 * tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { MedicalSearch } from '../medical.search.ts';
import type { MrListParams } from '../shared/medical-contracts.ts';

/** The list read's params for the URL as it stands — what the tab hands `useMrList`. */
export function mrParamsOf(search: MedicalSearch): MrListParams {
  return {
    q: search.q,
    created: search.created,
    ...sortParamsOf(search.sort, ['name'] as const),
  };
}

/** The params the footer reads — the filters alone: a sort changes no count. */
export function mrSummaryParamsOf({ q, created }: MrListParams): MrListParams {
  return { q, created };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function mrFilterKey(params: MrListParams): string {
  return JSON.stringify([params.q, params.created]);
}
