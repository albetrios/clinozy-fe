import type { LeadListParams, LeadSortKey } from '@/shared/api/clinic/leads-contracts.ts';

import { LEADS_SEARCH_DEFAULTS, type LeadsSearch } from '../../leads.search.ts';

/*
 * Kept out of `leads.search.ts`: the search schema rides in the entry chunk
 * (`routeTree.tsx` validates with it), and only the lazy list reads this.
 */

/**
 * The list read's params for the URL as it stands (defaults applied, the view
 * read against the viewer's membership) — what the Leads list hands `useLeadList`.
 */
export function leadListParamsOf(
  search: LeadsSearch,
  viewerId: string | null,
): LeadListParams {
  const [sort, order] = (search.sort?.split(':') ?? []) as [
    LeadSortKey?,
    ('asc' | 'desc')?,
  ];
  return {
    view: search.view ?? LEADS_SEARCH_DEFAULTS.view,
    viewerId,
    q: search.q,
    status: search.status,
    source: search.source,
    hold: search.hold,
    member: search.member,
    created: search.created,
    followUp: search.followUp,
    sort,
    order,
  };
}
