/**
 * URL search-param schemas for the Leads room (consumed by routeTree's
 * `validateSearch`): the list's view, search, filters and sort (KICKOFF §6.3,
 * `S:22`), as clinozy-be's lead list takes them (api-integration §5.2). A value
 * the URL can't hold — an unknown status, a bad date range — is dropped, never an
 * error. Defaults stay out of the URL (`/leads` is the Mine view). New lead's
 * prefill is `leads.dialog-search.ts`'s, off the entry.
 *
 * The API's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod. The test pins
 * each list to the contract's enum.
 */
import {
  listOf,
  matchOf,
  oneOf,
  PUBLIC_ID,
  queryOf,
  sortOf,
} from '@/lib/routes/search-params.ts';
import {
  AGE_BANDS,
  type AgeBand,
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from '@/shared/api/app/app-list-filters.ts';
import type { LeadSource, LeadStatus } from '@/shared/api/app/app-schema.ts';
import type {
  LeadHoldFilter,
  LeadSortKey,
  LeadView,
} from '@/shared/api/app/leads-contracts.ts';

const VIEWS = ['mine', 'unreplied', 'all'] as const satisfies readonly LeadView[];
const STATUSES = [
  'new',
  'contacted',
  'follow_up',
  'clinic_visited',
  'no_response',
  'not_interested',
  'invalid',
  'lost',
  'appointment_scheduled',
] as const satisfies readonly LeadStatus[];
const SOURCES = [
  'instagram',
  'google',
  'whatsapp',
  'facebook',
  'walk_in',
  'referral',
  'retarget',
] as const satisfies readonly LeadSource[];
const HOLDS = ['open', 'soon', 'held'] as const satisfies readonly LeadHoldFilter[];
const SORT_KEYS = [
  'name',
  'status',
  'source',
  'activity',
] as const satisfies readonly LeadSortKey[];

/** A column sort in the URL: `name:asc`, `activity:desc` (the shared table's form). */
type LeadsSort = `${LeadSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for `/leads` and its dialog routes. */
export interface LeadsSearch {
  /** Mine (default) · Unreplied · All. */
  view?: LeadView;
  /** A name, a number's digits, "#2371" or "C-12345" (≤ 80 characters). */
  q?: string;
  /** One status — the design's filter is single (`leads.md:180`). */
  status?: LeadStatus;
  /** Any of these sources. */
  source?: LeadSource[];
  /** Ownership: open to claim, releasing today, held ("Any" when absent). */
  hold?: LeadHoldFilter;
  /** Team: one member (`mem_…`), matched as the owner or one of the involved. */
  member?: string;
  /** The person's age band (feat-approximate-age). */
  age?: AgeBand;
  created?: CreatedFilter;
  /** Follow-up date — a preset or a range; the API has no "Not set" (G2). */
  followUp?: Exclude<FollowUpFilter, 'not_set'>;
  sort?: LeadsSort;
}

/** The list's state when the URL says nothing. */
export const LEADS_SEARCH_DEFAULTS = { view: 'mine' } as const satisfies LeadsSearch;

/** A Follow-up filter the API can read — every preset but "Not set", or a range. */
function readLeadFollowUp(value: unknown): LeadsSearch['followUp'] {
  const filter = readFollowUpFilter(value);
  return filter === 'not_set' ? undefined : filter;
}

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
    member: matchOf(
      PUBLIC_ID,
      Array.isArray(search.member) ? search.member[0] : search.member,
    ),
    age: oneOf(AGE_BANDS, search.age),
    created: readCreatedFilter(search.created),
    followUp: readLeadFollowUp(search.followUp),
    sort: sortOf(SORT_KEYS, search.sort),
  };
}
