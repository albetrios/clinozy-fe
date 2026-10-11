import { createdFilterMatches } from '@/shared/api/app/app-filter-match.ts';
import type { CreatedFilter } from '@/shared/api/app/app-list-filters.ts';
import { offerMatchesSearch } from '@/shared/api/app/offerings-api.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import type {
  RoomFilterField,
  RoomFilterFields,
  RoomFilterValues,
} from '@/shared/components/RoomToolbar/index.ts';

import {
  branchOrder,
  branchValues,
  matchesPicked,
  presentValuesField,
} from '../shared/offerings-filters.ts';
import { OFFER_STATE_FILTER } from './offers.search.ts';

/*
 * The Offers tab's rows (KICKOFF §6.11 Offers tab; H:5470–5484): every offer as
 * clinozy-be answers it — its `status` and its place in the list are the
 * server's (Running → Scheduled → Paused → Ended, newest first in each, O10) —
 * searched and filtered in place.
 */

/** An Offers row: the record, its `status` the server's, and its Branches chips. */
export interface OfferRow extends OfferRecord {
  /** The Branches cell's values (`branchValues`): branch ids, `all`, or none. */
  branches: string[];
}

/** What the rows need beside the records. */
export interface OfferRowsContext {
  /** The open branches' ids, main first. */
  openBranchIds: readonly string[];
}

/**
 * The offers a search keeps — name, code or an offering's name (H:5476; the
 * server's `q` reads the first two only) — as rows, in the order the server
 * listed them.
 */
export function offerRows(
  offers: readonly OfferRecord[],
  offerings: readonly Pick<OfferingRecord, 'id' | 'name'>[],
  query: string | undefined,
  context: OfferRowsContext,
): OfferRow[] {
  const names = new Map(offerings.map((offering) => [offering.id, offering.name]));
  return offers
    .filter((offer) => !query || offerMatchesSearch(offer, query, (id) => names.get(id)))
    .map((offer) => ({
      ...offer,
      branches: branchValues(offer.branchIds, context.openBranchIds),
    }));
}

/** What each filterable column shows for a row. */
const COLUMN_VALUES = {
  branch: (row: OfferRow) => row.branches,
  status: (row: OfferRow) => [row.status],
} as const;

/**
 * The Filters sections the rows hold (`offerings.md:187`): Branches · Status,
 * each only with 2–10 values across the rows, then Created, always.
 */
export function offerFilterFields(
  rows: readonly OfferRow[],
  context: OfferRowsContext,
): RoomFilterFields {
  const sections = {
    branch: presentValuesField(
      rows.map(COLUMN_VALUES.branch),
      branchOrder(context.openBranchIds),
    ),
    status: presentValuesField(rows.map(COLUMN_VALUES.status), OFFER_STATE_FILTER),
  };
  const fields: Record<string, RoomFilterField> = {};
  for (const [key, field] of Object.entries(sections)) {
    if (field) fields[key] = field;
  }
  fields.created = { kind: 'date', presets: 'created' };
  return fields;
}

/**
 * The rows the applied filters keep (only the sections the rows hold apply);
 * Created reads its presets on the clinic's `today`.
 */
export function filterOfferRows(
  rows: readonly OfferRow[],
  applied: RoomFilterValues,
  created: CreatedFilter | undefined,
  today: string,
): OfferRow[] {
  return rows.filter(
    (row) =>
      matchesPicked(COLUMN_VALUES.branch(row), applied.branch) &&
      matchesPicked(COLUMN_VALUES.status(row), applied.status) &&
      (!created || createdFilterMatches(row.createdAt, created, today)),
  );
}
