import { createdFilterMatches } from '@/shared/api/clinic/clinic-filter-match.ts';
import type { CreatedFilter } from '@/shared/api/clinic/clinic-list-filters.ts';
import {
  compareOffersForList,
  offerMatchesSearch,
} from '@/shared/api/clinic/offerings-api.ts';
import type {
  OfferingRecord,
  OfferRecord,
  OfferState,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { offerState } from '@/shared/api/clinic/offerings-pricing.ts';
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
 * The Offers tab's rows (KICKOFF §6.11 Offers tab; H:5470–5484): every offer
 * with its derived state, searched, filtered and kept in the tab's fixed
 * order — Running → Scheduled → Paused → Ended, newest first in each.
 */

/** An Offers row: the record, its state today and its Branches chips. */
export interface OfferRow extends OfferRecord {
  /** Paused, Scheduled, Ended or Running (`live`) on the clinic's today. */
  state: OfferState;
  /** The Branches cell's values (`branchValues`): branch ids, `all`, or none. */
  branches: string[];
}

/** What the rows need beside the records. */
export interface OfferRowsContext {
  /** The clinic-local day states are read on. */
  today: string;
  /** The open branches' ids, main first. */
  openBranchIds: readonly string[];
}

/**
 * The offers a search keeps — name, code or an offering's name (H:5476) — as
 * rows, in the tab's fixed order (H:5477).
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
    .sort(compareOffersForList(context.today))
    .map((offer) => ({
      ...offer,
      state: offerState(offer, context.today),
      branches: branchValues(offer.branchIds, context.openBranchIds),
    }));
}

/** What each filterable column shows for a row. */
const COLUMN_VALUES = {
  branch: (row: OfferRow) => row.branches,
  status: (row: OfferRow) => [row.state],
} as const;

/**
 * The Filters sections the rows hold (`offerings.md:187`): Branches · Status,
 * each only with 2–10 values across the rows, then Created, always.
 */
export function offerFilterFields(
  rows: readonly OfferRow[],
  context: Pick<OfferRowsContext, 'openBranchIds'>,
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

/** The rows the applied filters keep (only the sections the rows hold apply). */
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
