import { useSearch } from '@tanstack/react-router';

import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';

import {
  countRoomFilters,
  type RoomFilterFields,
  roomFilterSearchPatch,
  type RoomFilterValues,
  roomFilterValues,
} from './room-filters.ts';

/** A room's applied filters, read from and written to the URL. */
export interface RoomFiltersState {
  /** The filters the list shows now — the URL's. */
  applied: RoomFilterValues;
  /** How many are on: the Filters button's count. */
  count: number;
  /** Replace every filter with `values` in the URL (`{}` clears them all). */
  apply: (values: RoomFilterValues) => void;
}

/**
 * The URL is the one home of a room's applied filters (KICKOFF §3.5): read
 * through the room's filter fields, written through the same
 * `useDataTableUrlState` patch the table's own URL state uses (in place, hash
 * kept). The list re-fetches because its query reads the same search.
 */
export function useRoomFilters(fields: RoomFilterFields): RoomFiltersState {
  const search: Readonly<Record<string, unknown>> = useSearch({ strict: false });
  const { patchSearch } = useDataTableUrlState(true);
  const applied = roomFilterValues(fields, search);
  return {
    applied,
    count: countRoomFilters(fields, applied),
    apply: (values) => patchSearch(roomFilterSearchPatch(fields, values)),
  };
}
