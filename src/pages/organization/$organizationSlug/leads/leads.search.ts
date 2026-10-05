/**
 * URL search-param schemas for the Leads room (consumed by routeTree's
 * `validateSearch`): the list's view, search, filters and sort (KICKOFF §6.3,
 * `S:22`). A value the URL can't hold — an unknown status, a bad date range —
 * is dropped, never an error. Defaults stay out of the URL (`/leads` is the
 * Mine view). New lead's prefill is `leads.dialog-search.ts`'s, off the entry.
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod. The test pins
 * each list to the contract's enum.
 */
import { listOf, oneOf, queryOf, RECORD_ID, sortOf } from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import type { LeadStatus } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LeadHoldFilter,
  LeadRecordSource,
  LeadSortKey,
  LeadView,
} from '@/shared/api/clinic/leads-contracts.ts';

const VIEWS = ['mine', 'unread', 'all'] as const satisfies readonly LeadView[];
const STATUSES = [
  'new',
  'contacted',
  'follow_up',
  'clinic_visited',
  'no_response',
  'not_interested',
  'invalid',
  'lost',
] as const satisfies readonly LeadStatus[];
const SOURCES = [
  'instagram',
  'google',
  'whatsapp',
  'facebook',
  'walk_in',
  'referral',
  'retarget',
  'phone_call',
] as const satisfies readonly LeadRecordSource[];
const HOLDS = ['open', 'soon', 'held'] as const satisfies readonly LeadHoldFilter[];
const SORT_KEYS = [
  'name',
  'status',
  'source',
  'updated',
] as const satisfies readonly LeadSortKey[];

/** A column sort in the URL: `name:asc`, `updated:desc` (the shared table's form). */
type LeadsSort = `${LeadSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for `/leads` and its dialog routes. */
export interface LeadsSearch {
  /** Mine (default) · Unreplied · All. */
  view?: LeadView;
  /** Name, mobile or "#ID" (≤ 80 characters, the contract's `q`). */
  q?: string;
  /** One status — the design's filter is single (`leads.md:180`). */
  status?: LeadStatus;
  /** Any of these sources. */
  source?: LeadRecordSource[];
  /** Ownership: open to claim, releasing today, held ("Any" when absent). */
  hold?: LeadHoldFilter;
  /** Team: staff ids, each matched as owner or involved. */
  owner?: string[];
  created?: CreatedFilter;
  followUp?: FollowUpFilter;
  sort?: LeadsSort;
}

/** The list's state when the URL says nothing. */
export const LEADS_SEARCH_DEFAULTS = { view: 'mine' } as const satisfies LeadsSearch;

/**
 * Parse `/leads` search params. Every key is answered, `undefined` included:
 * the router keeps a raw value the schema omits, so dropping one means saying so.
 */
export function validateLeadsSearch(search: Record<string, unknown>): LeadsSearch {
  return {
    view: oneOf(VIEWS, search.view),
    q: queryOf(search.q, 80),
    status: oneOf(STATUSES, search.status),
    source: listOf(search.source, (entry) => oneOf(SOURCES, entry) !== undefined),
    hold: oneOf(HOLDS, search.hold),
    owner: listOf(search.owner, (entry) => RECORD_ID.test(entry)),
    created: readCreatedFilter(search.created),
    followUp: readFollowUpFilter(search.followUp),
    sort: sortOf(SORT_KEYS, search.sort),
  };
}
