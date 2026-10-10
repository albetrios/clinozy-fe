import { vi } from 'vitest';

import { branchRef } from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import {
  offerChangeOf,
  offerCreateBodyOf,
  type OfferFields,
  type OfferingRecord,
  type OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { offeringRecord, offerRecord } from '@/tests/utils/offering-doubles.ts';

/*
 * The Offers tab's world as clinozy-be would answer it (`/app/offerings`, `/app/offers`): the
 * local stack's own records — rupees, public ids, each offer's `status` the server's and the
 * list in the server's order (live → scheduled → paused → ended) — and an `offerings-api.ts`
 * double over it whose writes record what they would send.
 */

/** Research Peel (#5, ₹2,000, billed ₹1,800, floor ₹1,500). */
export const PEEL_ID = 'off_xh6ravxjcszcpta6taym0';
/** Research Default GST (#6) — made inactive since. */
export const DEFAULT_GST_ID = 'off_nl9wbfq42fsg6543qmwk7';
/** Offerings P0 Probe (#7, ₹1,400, floor ₹1,000). */
export const PROBE_ID = 'off_vza48ceuy385fkj5lxp98';

/** P0 Probe offer — ₹100.50 off, live, every branch. */
export const PROBE_OFFER_ID = 'ofr_cf68gw4yvhq1ezcl6uocy';
/** Research Future — +50 sessions from 1 Dec, at Vesu: scheduled. */
const FUTURE_OFFER_ID = 'ofr_nl8nlbtlaiurgzfq26y8t';
/** Research Diwali glow — 15% off, paused. */
export const GLOW_OFFER_ID = 'ofr_w28ixe5gwcf3crpeed4zu';
/** Research Past — ₹250.50 off in September: ended. */
export const PAST_OFFER_ID = 'ofr_ztlz67deab7f5yeztz3kl';

/** The id the next created offer gets. */
const CREATED_OFFER_ID = 'ofr_p3createdoffer00000000';

/** What the double holds and what its writes saw. */
export interface OffersWorld {
  offerings: OfferingRecord[];
  /** In the server's order. */
  offers: OfferRecord[];
  /** Deleted offers, restorable. */
  deleted: OfferRecord[];
  /** Each create's body, as `POST /app/offers` would take it. */
  created: unknown[];
  /** Each edit's body — only what changed — as `PATCH /app/offers/:offer_id` would take it. */
  changes: { offerId: string; body: unknown }[];
  /** The next write's refusal, once. */
  refuseNext: HttpError | null;
  /** The reads fail until cleared. */
  readsFail: boolean;
}

/** The offerings and offers on the local stack (Demo Organization), in the server's order. */
export function seededOffersWorld(): OffersWorld {
  return {
    offerings: [
      offeringRecord({ branchIds: [branchRef('Vesu')] }),
      offeringRecord({
        id: DEFAULT_GST_ID,
        offeringNumber: 6,
        name: 'Research Default GST',
        tone: 'sky',
        price: 1000,
        offerPrice: null,
        minPrice: 0,
        isActive: false,
        branchIds: [],
        searchTerms: [],
      }),
      offeringRecord({
        id: PROBE_ID,
        offeringNumber: 7,
        name: 'Offerings P0 Probe',
        tone: 'lav',
        price: 1400,
        offerPrice: null,
        minPrice: 1000,
        branchIds: [],
        searchTerms: ['probe'],
      }),
    ],
    offers: [
      offerRecord({
        id: PROBE_OFFER_ID,
        name: 'P0 Probe offer',
        code: 'P0PROBE',
        kind: 'amount',
        value: 100.5,
        offeringIds: [PROBE_ID],
        note: 'Probe note',
        createdAt: '2026-10-10T05:40:00.000Z',
        updatedAt: '2026-10-10T05:45:00.000Z',
      }),
      offerRecord({
        id: FUTURE_OFFER_ID,
        name: 'Research Future',
        code: null,
        kind: 'extra',
        value: 50,
        branchIds: [branchRef('Vesu')],
        startsOn: '2026-12-01',
        status: 'scheduled',
        tone: 'sky',
      }),
      offerRecord({
        id: GLOW_OFFER_ID,
        offeringIds: [DEFAULT_GST_ID, PEEL_ID],
        isActive: false,
        status: 'paused',
      }),
      offerRecord({
        id: PAST_OFFER_ID,
        name: 'Research Past',
        code: null,
        kind: 'amount',
        value: 250.5,
        offeringIds: [DEFAULT_GST_ID],
        startsOn: '2026-09-01',
        endsOn: '2026-09-30',
        status: 'ended',
        tone: 'butter',
      }),
    ],
    deleted: [],
    created: [],
    changes: [],
    refuseNext: null,
    readsFail: false,
  };
}

/** A refusal as clinozy-be words it. */
export function apiRefusal(
  status: number,
  error: Record<string, unknown>,
  url = '/api/v1/app/offers',
): HttpError {
  return new HttpError(`HTTP ${status}`, status, url, 'PATCH', { error });
}

/** `409 record_changed` — someone saved the offer since it was read (D43). */
const staleRefusal = () =>
  apiRefusal(409, {
    type: 'request_error',
    code: 'conflict',
    reason: 'record_changed',
    detail: 'This record was changed by someone else — reload and try again',
  });

/** `409 offer_code_in_use` — another live offer has the code. */
export const codeInUseRefusal = () =>
  apiRefusal(409, {
    type: 'request_error',
    code: 'conflict',
    reason: 'offer_code_in_use',
    detail: 'Another live offer already uses this code',
  });

/** The 400 an offer names an inactive offering with (O12, OFFERINGS-M5). */
export const inactiveOfferingRefusal = (offeringId: string) =>
  apiRefusal(400, {
    type: 'validation_error',
    code: 'invalid_field',
    detail: `${offeringId} is not an active offering of this organization`,
    errors: [
      {
        field: 'offering_ids',
        message: `${offeringId} is not an active offering of this organization`,
      },
    ],
  });

/** The offer as the server keeps it after a write: its status worked out again. */
function settled(offer: OfferRecord): OfferRecord {
  return { ...offer, status: offer.isActive ? 'live' : 'paused' };
}

/** The world's next refusal, cleared as it is thrown. */
function refuseOnce(world: OffersWorld) {
  const refusal = world.refuseNext;
  if (!refusal) return;
  world.refuseNext = null;
  throw refusal;
}

/** The read's outcome — a dropped connection while `readsFail`. */
function readOrFail<T>(world: OffersWorld, value: () => T): Promise<T> {
  if (world.readsFail) {
    return Promise.reject(new HttpError('HTTP 503', 503, '/api/v1/app/offers', 'GET'));
  }
  return Promise.resolve(structuredClone(value()));
}

/** One offer by id, or the 404 clinozy-be answers. */
function offerOf(world: OffersWorld, offerId: string): OfferRecord {
  const offer = world.offers.find((candidate) => candidate.id === offerId);
  if (!offer) {
    throw apiRefusal(404, { code: 'not_found', detail: 'Offer not found' });
  }
  return offer;
}

/** What a write of the api module takes. */
type WriteArgs<Name extends keyof typeof OfferingsApiModule> = Parameters<
  (typeof OfferingsApiModule)[Name] extends (...args: never[]) => unknown
    ? (typeof OfferingsApiModule)[Name]
    : never
>[0];

/** The offer a create or an edit leaves, the code upper-cased as the server stores it. */
function written(base: OfferRecord, fields: OfferFields, at: string): OfferRecord {
  return settled({
    ...base,
    ...fields,
    code: fields.code?.toUpperCase() ?? null,
    updatedAt: at,
  });
}

/** Replace one offer in place. */
function put(world: OffersWorld, next: OfferRecord): OfferRecord {
  world.offers = world.offers.map((offer) => (offer.id === next.id ? next : offer));
  return structuredClone(next);
}

/**
 * The live reads and writes of `offerings-api.ts` over `world`, each a `vi.fn` the tests can
 * read: the bodies the builders make (`offerCreateBodyOf`, `offerChangeOf`) are recorded, a
 * stale `expected_updated_at` is a `409 record_changed`.
 */
export function offersApiDouble(world: OffersWorld): Partial<typeof OfferingsApiModule> {
  return {
    fetchAllOfferings: vi.fn(() => readOrFail(world, () => world.offerings)),
    fetchAllOffers: vi.fn(() => readOrFail(world, () => world.offers)),
    fetchOffer: vi.fn(async (offerId: string) =>
      readOrFail(world, () => offerOf(world, offerId)),
    ),
    createOffer: vi.fn(async ({ fields }: WriteArgs<'createOffer'>) => {
      refuseOnce(world);
      world.created.push(offerCreateBodyOf(fields));
      const at = '2026-10-10T06:30:00.000Z';
      const offer = written(
        { ...offerRecord(), id: CREATED_OFFER_ID, createdAt: at },
        fields,
        at,
      );
      world.offers = [offer, ...world.offers];
      return structuredClone(offer);
    }),
    updateOffer: vi.fn(async ({ record, fields }: WriteArgs<'updateOffer'>) => {
      const body = offerChangeOf(record, fields);
      if (!body) return record;
      world.changes.push({ offerId: record.id, body });
      refuseOnce(world);
      const saved = offerOf(world, record.id);
      if (saved.updatedAt !== record.updatedAt) throw staleRefusal();
      return put(world, written(saved, fields, '2026-10-10T06:31:00.000Z'));
    }),
    setOfferActive: vi.fn(async ({ offerId, isActive }: WriteArgs<'setOfferActive'>) => {
      refuseOnce(world);
      return put(world, settled({ ...offerOf(world, offerId), isActive }));
    }),
    deleteOffer: vi.fn(async ({ offerId }: WriteArgs<'deleteOffer'>) => {
      refuseOnce(world);
      const offer = offerOf(world, offerId);
      world.offers = world.offers.filter((candidate) => candidate.id !== offerId);
      world.deleted.push(offer);
    }),
    restoreOffer: vi.fn(async (offerId: string) => {
      const offer = world.deleted.find((candidate) => candidate.id === offerId);
      if (!offer) throw apiRefusal(404, { code: 'not_found', detail: 'Offer not found' });
      world.deleted = world.deleted.filter((candidate) => candidate.id !== offerId);
      world.offers = [...world.offers, offer];
      return structuredClone(offer);
    }),
  };
}
