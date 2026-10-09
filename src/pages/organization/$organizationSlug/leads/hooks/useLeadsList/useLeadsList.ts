import { useSearch } from '@tanstack/react-router';
import type { SortingState } from '@tanstack/react-table';

import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import type {
  LeadListParams,
  LeadRecord,
  LeadView,
} from '@/shared/api/clinic/leads-contracts.ts';
import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';
import {
  sortingFromSearch,
  sortingToSearch,
  useDataTableUrlState,
} from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useLeadList, useUnrepliedLeadCount } from '@/shared/hooks/useLeads/index.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';

import {
  LEADS_SEARCH_DEFAULTS,
  type LeadsSearch,
  validateLeadsSearch,
} from '../../leads.search.ts';
import { leadListParamsOf } from './lead-list-params.ts';

/** The URL keys the Filters and the search own — what "Clear filters" empties. */
const FILTER_KEYS = [
  'q',
  'status',
  'source',
  'hold',
  'member',
  'created',
  'followUp',
] as const satisfies readonly (keyof LeadsSearch)[];

/** Everything the Leads list reads, and the URL writes it makes. */
export interface LeadsListState {
  search: LeadsSearch;
  view: LeadView;
  params: LeadListParams;
  list: CursorListResult<LeadRecord>;
  /** The first page is on its way — a caller off the team has no Mine to wait for. */
  loading: boolean;
  /** The signed-in member's membership id; `null` for a caller who is not on the team. */
  viewerId: string | null;
  /** The active members — owners, involved people, the Team filter. */
  members: readonly DirectoryMember[];
  team: ReadonlyMap<string, DirectoryMember>;
  /** When the team was read — the team card's "Updated HH:MM". */
  teamUpdatedAt: string | null;
  /** The Unreplied tab's count. */
  unreplied: number;
  /** A search or a filter applies — the empty line offers "Clear filters". */
  filtered: boolean;
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  setView: (view: LeadView) => void;
  clearFilters: () => void;
}

/**
 * The Leads list's state (KICKOFF §6.3): the URL's view, search, filters and
 * sort (`leads.search.ts`) read against the signed-in member's membership —
 * "Mine" and "Unreplied" wait for it — the cursor-paged list, the team and the
 * Unreplied count; and the URL writes the toolbar and the headers make (in
 * place, hash kept).
 */
export function useLeadsList(): LeadsListState {
  const raw: Record<string, unknown> = useSearch({ strict: false });
  const search = validateLeadsSearch(raw);
  const { patchSearch } = useDataTableUrlState(true);
  const membershipId = useMyMembershipId();
  const viewerId = membershipId ?? null;
  const view = search.view ?? LEADS_SEARCH_DEFAULTS.view;
  const params = leadListParamsOf(search, viewerId);
  // Mine and Unreplied are the viewer's own: they wait for the membership, and a caller off
  // the team (no membership) has none.
  const enabled = view === 'all' || viewerId !== null;
  const list = useLeadList(params, { enabled });
  const directory = useTeamDirectory();
  const unreplied = useUnrepliedLeadCount(viewerId).data ?? 0;

  return {
    search,
    view,
    params,
    list,
    loading: list.isPending && (enabled || membershipId === undefined),
    viewerId,
    members: directory.members,
    team: directory.byId,
    teamUpdatedAt: directory.updatedAt,
    unreplied,
    filtered: FILTER_KEYS.some((key) => {
      const value = search[key];
      return Array.isArray(value) ? value.length > 0 : value !== undefined;
    }),
    sorting: sortingFromSearch(search.sort),
    setSorting: (sorting) => patchSearch({ sort: sortingToSearch(sorting) }),
    setView: (next) =>
      patchSearch({ view: next === LEADS_SEARCH_DEFAULTS.view ? undefined : next }),
    clearFilters: () =>
      patchSearch(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined]))),
  };
}
