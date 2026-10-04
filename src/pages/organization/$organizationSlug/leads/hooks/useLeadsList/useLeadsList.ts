import { useSearch } from '@tanstack/react-router';
import type { SortingState } from '@tanstack/react-table';
import { useMemo } from 'react';

import type {
  LeadListParams,
  LeadRecord,
  LeadView,
} from '@/shared/api/clinic/leads-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';
import {
  sortingFromSearch,
  sortingToSearch,
  useDataTableUrlState,
} from '@/shared/hooks/useDataTableUrlState/index.ts';
import {
  useLeadList,
  useLeadViewer,
  useUnrepliedLeadCount,
} from '@/shared/hooks/useLeads/index.ts';
import { useStaffProfiles } from '@/shared/hooks/useTeam/index.ts';

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
  'owner',
  'created',
  'followUp',
] as const satisfies readonly (keyof LeadsSearch)[];

/** Everything the Leads list reads, and the URL writes it makes. */
export interface LeadsListState {
  search: LeadsSearch;
  view: LeadView;
  params: LeadListParams;
  list: CursorListResult<LeadRecord>;
  /** The signed-in member as the room reads them (`useLeadViewer`). */
  viewer: StaffProfile | null;
  /** Every staff profile — owners, involved people, the Team filter. */
  staff: StaffProfile[];
  staffById: ReadonlyMap<string, StaffProfile>;
  /** When the team was read — the team card's "Updated HH:MM". */
  staffUpdatedAt: string | null;
  /** The Unreplied tab's count. */
  unreplied: number;
  /** A search or a filter applies — the empty line offers "Clear filters". */
  filtered: boolean;
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  setView: (view: LeadView) => void;
  clearFilters: () => void;
}

const NO_STAFF: StaffProfile[] = [];

/**
 * The Leads list's state (KICKOFF §6.3): the URL's view, search, filters and
 * sort (`leads.search.ts`) read against the signed-in member — "Mine" waits
 * for them — the cursor-paged list, the team and the Unreplied count; and the
 * URL writes the toolbar and the headers make (in place, hash kept).
 */
export function useLeadsList(): LeadsListState {
  const raw: Record<string, unknown> = useSearch({ strict: false });
  const search = validateLeadsSearch(raw);
  const { patchSearch } = useDataTableUrlState(true);
  const viewerQuery = useLeadViewer();
  const viewer = viewerQuery.data ?? null;
  const view = search.view ?? LEADS_SEARCH_DEFAULTS.view;
  const params = leadListParamsOf(search, viewer?.id ?? null);
  const list = useLeadList(params, {
    enabled: view === 'all' || !viewerQuery.isPending,
  });
  const staffQuery = useStaffProfiles();
  const staff = staffQuery.data ?? NO_STAFF;
  const staffById = useMemo(
    () => new Map(staff.map((profile) => [profile.id, profile])),
    [staff],
  );
  const unreplied = useUnrepliedLeadCount(viewer?.id ?? null).data ?? 0;

  return {
    search,
    view,
    params,
    list,
    viewer,
    staff,
    staffById,
    staffUpdatedAt: staffQuery.dataUpdatedAt
      ? new Date(staffQuery.dataUpdatedAt).toISOString()
      : null,
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
