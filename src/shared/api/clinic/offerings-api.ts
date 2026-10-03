import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import {
  clinicHttpError,
  compareText,
  type CursorPage,
  definedFields,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import type { DeleteReason } from './clinic-schema.ts';
import { clinicToday } from './clinic-time.ts';
import {
  OFFER_DEFAULTS,
  OFFER_STATE_VALUES,
  type OfferCreateInput,
  OFFERING_DEFAULTS,
  type OfferingCreateInput,
  type OfferingInput,
  offeringInputSchema,
  type OfferingListParams,
  type OfferingPatch,
  type OfferingRecord,
  type OfferInput,
  offerInputSchema,
  type OfferListParams,
  type OfferPatch,
  type OfferRecord,
} from './offerings-contracts.ts';
import { offerState } from './offerings-pricing.ts';

/*
 * The Offerings domain's reads and writes (`S:1730–1741`), on the fixture
 * world until clinozy-be serves them — every call is REPLACE_WITH_API (D6). The
 * world is imported on demand, so its seed data never lands in a route chunk.
 */

/** TanStack Query keys for the offerings catalogue. */
export const offeringQueryKeys = {
  all: ['clinic', 'offerings'] as const,
  /** The whole catalogue — every room reads it from this one entry. */
  list: () => [...offeringQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...offeringQueryKeys.all, 'detail', id] as const,
};

/** TanStack Query keys for the offers. */
export const offerQueryKeys = {
  all: ['clinic', 'offers'] as const,
  /** Every offer — the Offers tab and every price read it from this one entry. */
  list: () => [...offerQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...offerQueryKeys.all, 'detail', id] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

const UNKNOWN_BRANCH = 'Pick branches the clinic has';

// ── Search and order (the fixture server's, and the rooms' in place) ──

/** Whether an offering matches a search: its name, its search terms or "#274" (H:5454). */
export function offeringMatchesSearch(
  offering: Pick<OfferingRecord, 'name' | 'searchTerms' | 'seq'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${offering.name} ${offering.searchTerms.join(' ')} #${offering.seq}`
    .toLowerCase()
    .includes(needle);
}

/**
 * Whether an offer matches a search: its name, its code or the name of an
 * offering it applies to (H:5476).
 *
 * @param offeringName An offering's name by id (`undefined` when unknown).
 */
export function offerMatchesSearch(
  offer: Pick<OfferRecord, 'name' | 'code' | 'offeringIds'>,
  query: string,
  offeringName: (id: string) => string | undefined,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const names = offer.offeringIds.map((id) => offeringName(id) ?? '');
  return [offer.name, offer.code ?? '', ...names]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

/**
 * The Offers tab's fixed order (H:5477): Running → Scheduled → Paused → Ended,
 * newest first inside each group.
 */
export function compareOffersForList(
  today: string,
): (a: OfferRecord, b: OfferRecord) => number {
  const rank = (offer: OfferRecord) =>
    OFFER_STATE_VALUES.indexOf(offerState(offer, today));
  return (a, b) => rank(a) - rank(b) || compareText(b.createdAt, a.createdAt);
}

const OFFERING_ORDER = {
  updatedAt: (a, b) => compareText(a.updatedAt, b.updatedAt),
  name: (a, b) => a.name.localeCompare(b.name),
  price: (a, b) => a.price - b.price,
  category: (a, b) => compareText(a.category, b.category),
} satisfies Record<
  NonNullable<OfferingListParams['sort']>,
  (a: OfferingRecord, b: OfferingRecord) => number
>;

// ── Offerings ──

/**
 * One cursor page of live offerings (`listOfferings`, `S:1734`;
 * REPLACE_WITH_API): filtered by category, specialty and `q`, newest-updated
 * first unless another sort is asked for (ascending unless `order` says so).
 */
export async function listOfferings(
  params: OfferingListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<OfferingRecord>> {
  const { clinicFixtures } = await fixtureWorld();
  const key = params.sort ?? 'updatedAt';
  // The contract's default is the latest update first; an asked-for sort runs ascending.
  const defaultOrder = params.sort ? 'asc' : 'desc';
  const direction = (params.order ?? defaultOrder) === 'desc' ? -1 : 1;
  return clinicFixtures.offerings.list({
    where: (offering) =>
      (!params.category || offering.category === params.category) &&
      (!params.specialty || offering.specialty === params.specialty) &&
      offeringMatchesSearch(offering, params.q ?? ''),
    sort: (a, b) => direction * OFFERING_ORDER[key](a, b) || b.seq - a.seq,
    cursor,
  });
}

/**
 * Every live offering — each cursor page in turn. The catalogue is small, so
 * the rooms read it whole and search, filter and sort it in place (KICKOFF
 * §6.11 Lists).
 */
export function fetchAllOfferings(
  params: OfferingListParams = {},
): Promise<OfferingRecord[]> {
  return collectAllPages(async (cursor) => {
    const page = await listOfferings(params, cursor);
    return { rows: page.items, next: page.nextCursor };
  }, 'offerings');
}

/** One offering (`getOffering`; REPLACE_WITH_API) — a 404 when it is unknown or deleted. */
export async function fetchOffering(id: string): Promise<OfferingRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.offerings.get(id);
}

/**
 * The plan's save rules for an offering (H:5507): an empty offer price, or one
 * equal to the price, bills the list price (`null`); search terms drop blanks;
 * an empty description is none.
 */
function offeringDraft(fields: Partial<OfferingInput>): Partial<OfferingInput> {
  const { price, offerPrice, searchTerms, description } = fields;
  return {
    ...fields,
    offerPrice: offerPrice && offerPrice !== price ? offerPrice : null,
    ...(searchTerms
      ? { searchTerms: searchTerms.map((term) => term.trim()).filter(Boolean) }
      : {}),
    description: description?.trim() || null,
  };
}

/** Refuse what the contract's server refuses: a taken name (`S:1739`) and unknown branches. */
async function checkOffering(fields: OfferingInput, exceptId: string | null) {
  const { clinicFixtures } = await fixtureWorld();
  const name = fields.name.toLowerCase();
  const taken = clinicFixtures.offerings.snapshot(
    (offering) => offering.id !== exceptId && offering.name.trim().toLowerCase() === name,
  );
  if (taken.length > 0) {
    const message = 'An offering with this name already exists';
    throw clinicHttpError(409, 'conflict', message, { name: [message] });
  }
  refuseUnknownIds(
    'branchIds',
    fields.branchIds,
    clinicFixtures.branches.snapshot(),
    UNKNOWN_BRANCH,
  );
}

/**
 * Create an offering (`createOffering`, `S:1739`; REPLACE_WITH_API) from the
 * name and price plus whatever else is set — the rest from
 * {@link OFFERING_DEFAULTS}, the specialty the clinic's first (Q-O6). A 422
 * names a broken rule, a 409 a taken name.
 */
export async function createOffering(
  input: OfferingCreateInput,
): Promise<OfferingRecord> {
  const { clinicFixtures, clinicOrganization } = await fixtureWorld();
  const fields = validateClinicInput(
    offeringInputSchema,
    offeringDraft({
      ...OFFERING_DEFAULTS,
      specialty: clinicOrganization().specialties[0] ?? 'skin',
      ...definedFields(input),
    }),
  );
  await checkOffering(fields, null);
  return clinicFixtures.offerings.create(fields);
}

/**
 * Update an offering (`updateOffering`, `S:1739`; REPLACE_WITH_API). The patch
 * is merged into the saved record and the whole is checked again, so lowering
 * the price below the offer price is refused. A 404 when it is gone.
 */
export async function updateOffering(
  id: string,
  patch: OfferingPatch,
): Promise<OfferingRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.offerings.get(id);
  const fields = validateClinicInput(
    offeringInputSchema,
    offeringDraft({ ...saved, ...definedFields(patch) }),
  );
  await checkOffering(fields, id);
  return clinicFixtures.offerings.update(id, fields);
}

/**
 * Soft-delete an offering with the Reason confirm's choice (`S:1546`;
 * REPLACE_WITH_API) — "Other" needs a note (422). Offers keep naming it, so a
 * restore puts everything back.
 */
export async function deleteOffering(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<OfferingRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.offerings.remove(id, reason, note);
}

/** Restore a deleted offering — the Undo of its "removed" toast (`POST …/restore`, D32). */
export async function restoreOffering(id: string): Promise<OfferingRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.offerings.restore(id);
}

// ── Offers ──

/**
 * One cursor page of live offers (`listOffers`, `S:1735`; REPLACE_WITH_API):
 * filtered by the derived `state` on today's clinic date and by `q`, the
 * latest start first (an open start last).
 */
export async function listOffers(
  params: OfferListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<OfferRecord>> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const names = new Map(
    clinicFixtures.offerings.snapshot().map((offering) => [offering.id, offering.name]),
  );
  return clinicFixtures.offers.list({
    where: (offer) =>
      (!params.state || offerState(offer, today) === params.state) &&
      offerMatchesSearch(offer, params.q ?? '', (id) => names.get(id)),
    sort: (a, b) =>
      compareText(b.startsOn ?? '', a.startsOn ?? '') ||
      compareText(b.createdAt, a.createdAt),
    cursor,
  });
}

/** Every live offer — each cursor page in turn (the offers are few; KICKOFF §6.11 Lists). */
export function fetchAllOffers(params: OfferListParams = {}): Promise<OfferRecord[]> {
  return collectAllPages(async (cursor) => {
    const page = await listOffers(params, cursor);
    return { rows: page.items, next: page.nextCursor };
  }, 'offers');
}

/** One offer (REPLACE_WITH_API) — a 404 when it is unknown or deleted. */
export async function fetchOffer(id: string): Promise<OfferRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.offers.get(id);
}

/** The plan's save rules for an offer: the code upper-cased without spaces (H:5511), blanks as none. */
function offerDraft(fields: Partial<OfferInput>): Partial<OfferInput> {
  return {
    ...fields,
    code: fields.code?.replace(/\s/g, '').toUpperCase() || null,
    note: fields.note?.trim() || null,
  };
}

/** Refuse what the contract's server refuses: a taken code (`S:1740`), unknown offerings or branches. */
async function checkOffer(fields: OfferInput, exceptId: string | null) {
  const { clinicFixtures } = await fixtureWorld();
  if (fields.code) {
    const taken = clinicFixtures.offers.snapshot(
      (offer) => offer.id !== exceptId && offer.code === fields.code,
    );
    if (taken.length > 0) {
      const message = 'Another offer uses this code';
      throw clinicHttpError(409, 'conflict', message, { code: [message] });
    }
  }
  refuseUnknownIds(
    'offeringIds',
    fields.offeringIds,
    clinicFixtures.offerings.snapshot(),
    'Pick offerings the clinic sells',
  );
  refuseUnknownIds(
    'branchIds',
    fields.branchIds,
    clinicFixtures.branches.snapshot(),
    UNKNOWN_BRANCH,
  );
}

/**
 * Create an offer (`createOffer`, `S:1740`; REPLACE_WITH_API) from the name and
 * offerings plus whatever else is set — the rest from {@link OFFER_DEFAULTS}.
 * A 422 names a broken rule ("Ends before it starts"), a 409 a taken code.
 */
export async function createOffer(input: OfferCreateInput): Promise<OfferRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(
    offerInputSchema,
    offerDraft({ ...OFFER_DEFAULTS, ...definedFields(input) }),
  );
  await checkOffer(fields, null);
  return clinicFixtures.offers.create(fields);
}

/**
 * Update an offer (`updateOffer`, `S:1740`; REPLACE_WITH_API): the patch merged
 * into the saved record and the whole checked again. A 404 when it is gone.
 */
export async function updateOffer(id: string, patch: OfferPatch): Promise<OfferRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.offers.get(id);
  const fields = validateClinicInput(
    offerInputSchema,
    offerDraft({ ...saved, ...definedFields(patch) }),
  );
  await checkOffer(fields, id);
  return clinicFixtures.offers.update(id, fields);
}

/** Pause or resume an offer — the row's immediate Pause / Resume (`updateOffer({ paused })`, H:5483). */
export function setOfferPaused(id: string, paused: boolean): Promise<OfferRecord> {
  return updateOffer(id, { paused });
}

/** Soft-delete an offer with the Reason confirm's choice (`S:1546`; REPLACE_WITH_API). */
export async function deleteOffer(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<OfferRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.offers.remove(id, reason, note);
}

/** Restore a deleted offer — the Undo of its "removed" toast (`POST …/restore`, D32). */
export async function restoreOffer(id: string): Promise<OfferRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.offers.restore(id);
}
