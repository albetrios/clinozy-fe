import { createdFilterMatches } from '@/shared/api/clinic/clinic-filter-match.ts';
import type { CreatedFilter } from '@/shared/api/clinic/clinic-list-filters.ts';
import { offeringMatchesSearch } from '@/shared/api/clinic/offerings-api.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import {
  type EffectivePrice,
  effectivePrice,
} from '@/shared/api/clinic/offerings-pricing.ts';
import type {
  RoomFilterField,
  RoomFilterFields,
  RoomFilterValues,
} from '@/shared/components/RoomToolbar/index.ts';

import {
  OFFERING_CATEGORY_FILTER,
  OFFERING_STATUS_FILTER,
  type OfferingSortKey,
  type OfferingsSort,
  type OfferingStatusFilter,
} from './offerings.search.ts';
import {
  branchOrder,
  branchValues,
  matchesPicked,
  presentValuesField,
} from './shared/offerings-filters.ts';

/*
 * The Offerings tab's rows (KICKOFF §6.11 Offerings tab; H:5450–5469): every
 * offering clinozy-be holds, in its order (newest first), priced for the
 * header's branch, then searched, filtered and sorted in place — the catalogue
 * is read whole (§6.11 Lists).
 */

/** An Offerings row: the record, its price today and its Branches chips. */
export interface OfferingRow extends OfferingRecord {
  /** What is billed today for the pricing branch (`effectivePrice`, Q-O2). */
  priced: EffectivePrice<OfferRecord>;
  /** The Branches cell's values (`branchValues`): branch ids, `all`, or none. */
  branches: string[];
}

/** What pricing the rows needs beside the records. */
export interface OfferingRowsContext {
  /** The pricing branch (`pricingBranch`), `null` for no single branch. */
  branchId: string | null;
  /** The open branches' ids, main first. */
  openBranchIds: readonly string[];
}

/**
 * Every offering as a row, in the catalogue's order, priced for `branchId` by
 * the offers the server calls live.
 */
export function offeringRows(
  offerings: readonly OfferingRecord[],
  offers: readonly OfferRecord[],
  context: OfferingRowsContext,
): OfferingRow[] {
  return offerings.map((offering) => ({
    ...offering,
    priced: effectivePrice(offering, context.branchId, offers),
    branches: branchValues(offering.branchIds, context.openBranchIds),
  }));
}

/** The rows a search keeps: name, search terms or "#274" (H:5454). */
export function searchOfferingRows(
  rows: readonly OfferingRow[],
  query: string | undefined,
): OfferingRow[] {
  return query ? rows.filter((row) => offeringMatchesSearch(row, query)) : [...rows];
}

/** A row's status as the Status chips name it. */
export function offeringStatus(
  row: Pick<OfferingRecord, 'isActive'>,
): OfferingStatusFilter {
  return row.isActive ? 'active' : 'inactive';
}

/**
 * The minutes a row's Duration shows — none for a product, which takes no
 * chair time (the API still holds 5–480 for it; research gap 11).
 */
export function offeringDuration(
  row: Pick<OfferingRecord, 'category' | 'durationMin'>,
): number | null {
  return row.category === 'product' ? null : row.durationMin;
}

/** What each filterable column shows for a row — the values its chips match. */
const COLUMN_VALUES = {
  category: (row: OfferingRow) => [row.category],
  offer: (row: OfferingRow) =>
    row.priced.winningOffer ? [row.priced.winningOffer.id] : [],
  branch: (row: OfferingRow) => row.branches,
  status: (row: OfferingRow) => [offeringStatus(row)],
} as const;

/**
 * The Filters sections the rows hold (`offerings.md:187`): Category · Offer ·
 * Branches · Status, each only with 2–10 values across the rows, then
 * Created, always. The offer chips follow the Offers tab's order — the
 * server's (live, scheduled, paused, ended).
 */
export function offeringFilterFields(
  rows: readonly OfferingRow[],
  offers: readonly OfferRecord[],
  context: Pick<OfferingRowsContext, 'openBranchIds'>,
): RoomFilterFields {
  const offerOrder = offers.map((offer) => offer.id);
  const sections = {
    category: presentValuesField(
      rows.map(COLUMN_VALUES.category),
      OFFERING_CATEGORY_FILTER,
    ),
    offer: presentValuesField(rows.map(COLUMN_VALUES.offer), offerOrder),
    branch: presentValuesField(
      rows.map(COLUMN_VALUES.branch),
      branchOrder(context.openBranchIds),
    ),
    status: presentValuesField(rows.map(COLUMN_VALUES.status), OFFERING_STATUS_FILTER),
  };
  const fields: Record<string, RoomFilterField> = {};
  for (const [key, field] of Object.entries(sections)) {
    if (field) fields[key] = field;
  }
  fields.created = { kind: 'date', presets: 'created' };
  return fields;
}

/** The rows the applied filters keep (only the sections the rows hold apply). */
export function filterOfferingRows(
  rows: readonly OfferingRow[],
  applied: RoomFilterValues,
  created: CreatedFilter | undefined,
  today: string,
): OfferingRow[] {
  return rows.filter(
    (row) =>
      (Object.keys(COLUMN_VALUES) as (keyof typeof COLUMN_VALUES)[]).every((key) =>
        matchesPicked(COLUMN_VALUES[key](row), applied[key]),
      ) &&
      (!created || createdFilterMatches(row.createdAt, created, today)),
  );
}

/**
 * Each sortable column's comparison (H:5455): the billed price, a product's
 * duration as none, Active before Inactive.
 */
const SORT_COMPARE: Readonly<
  Record<OfferingSortKey, (a: OfferingRow, b: OfferingRow) => number>
> = {
  seq: (a, b) => a.offeringNumber - b.offeringNumber,
  name: (a, b) => {
    const [x, y] = [a.name.toLowerCase(), b.name.toLowerCase()];
    return Number(x > y) - Number(x < y);
  },
  category: (a, b) => Number(a.category > b.category) - Number(a.category < b.category),
  price: (a, b) => a.priced.final - b.priced.final,
  duration: (a, b) => (offeringDuration(a) ?? 0) - (offeringDuration(b) ?? 0),
  sessions: (a, b) => a.sessions - b.sessions,
  status: (a, b) => Number(!a.isActive) - Number(!b.isActive),
  updated: (a, b) =>
    Number(a.updatedAt > b.updatedAt) - Number(a.updatedAt < b.updatedAt),
};

/**
 * The rows in the URL's order (`offerings.md:33`): the server's — newest first
 * — by default; a column sort runs ascending from that order and descending
 * reverses it, ties included, as the prototype's stable sort does (H:5456).
 */
export function sortOfferingRows(
  rows: readonly OfferingRow[],
  sort: OfferingsSort | undefined,
): OfferingRow[] {
  const sorted = [...rows];
  if (!sort) return sorted;
  const [key, direction] = sort.split(':') as [OfferingSortKey, 'asc' | 'desc'];
  sorted.sort(SORT_COMPARE[key]);
  if (direction === 'desc') sorted.reverse();
  return sorted;
}
