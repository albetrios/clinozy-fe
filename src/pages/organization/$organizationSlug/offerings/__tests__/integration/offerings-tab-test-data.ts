/**
 * The Offerings tab's test catalogue, as clinozy-be would answer it — rupees, public ids, the
 * server's order (offerings newest first; offers live → scheduled → paused → ended) — and the
 * api doubles its suites mock `@/shared/api/clinic/offerings-api.ts` and the member's branches
 * with. Built on the room's shared doubles (`@/tests/utils/offering-doubles.ts`).
 *
 * What the rows come to with no single branch picked:
 * - #7 Hydra Glow Facial — ₹3,000 offer price, 15% Diwali glow → ₹2,550, raised to the ₹2,800
 *   floor: "₹2,800 · was ₹3,500 · 20% off".
 * - #6 Underarm Peel · 6 sessions (Vesu) — list price, "6 sessions + 1 free" (Bring a friend).
 * - #5 Research Peel (Vesu) — Vesu launch at ₹1,450 beats Diwali glow's ₹1,530, raised to the
 *   ₹1,500 floor: "₹1,500 · was ₹2,000 · 25% off"; at Adajan alone Diwali glow's ₹1,530.
 * - #4 Sunscreen SPF 50 — a product: ₹850.50, no duration ("—").
 * - #2 Old Laser Full Face (Adajan, Vesu) — inactive.
 * - #1 Consultation — Monsoon is paused, so the list price.
 */
import { vi } from 'vitest';

import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import {
  offeringRecord,
  offerRecord,
  TEST_OFFER_ID,
  TEST_OFFERING_BRANCH_ID,
  TEST_OFFERING_ID,
} from '@/tests/utils/offering-doubles.ts';

/** Adajan, the main branch. */
export const ADAJAN_ID = 'brn_53j4b7hz7nfb0otr2d920';

/** Vesu (where Research Peel is sold). */
export const VESU_ID = TEST_OFFERING_BRANCH_ID;

/** The catalogue's offering ids, by name. */
export const OFFERING_IDS = {
  hydra: 'off_hydraglowfacial000007',
  underarm: 'off_underarmpeelsix000006',
  researchPeel: TEST_OFFERING_ID,
  sunscreen: 'off_sunscreenspffifty0004',
  oldLaser: 'off_oldlaserfullface00002',
  consultation: 'off_consultationfirst0001',
} as const;

/** The offers' ids, by name. */
export const OFFER_IDS = {
  diwali: TEST_OFFER_ID,
  vesuLaunch: 'ofr_vesulaunchfixed000002',
  bringAFriend: 'ofr_bringafriendextra0003',
  monsoon: 'ofr_monsoontenpaused00004',
} as const;

/** The member's two open branches, the main one first. */
export const OFFERINGS_TAB_BRANCHES: BranchOption[] = [
  {
    id: ADAJAN_ID,
    name: 'Adajan',
    tone: 'sage',
    isMain: true,
    opensAt: '10:00',
    closesAt: '20:00',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  },
  {
    id: VESU_ID,
    name: 'Vesu',
    tone: 'sky',
    isMain: false,
    opensAt: '10:00',
    closesAt: '20:00',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  },
];

/** The catalogue in the server's order: newest first. */
export function offeringsTabCatalogue(): OfferingRecord[] {
  return [
    offeringRecord({
      id: OFFERING_IDS.hydra,
      offeringNumber: 7,
      name: 'Hydra Glow Facial',
      tone: 'blush',
      price: 3500,
      offerPrice: 3000,
      minPrice: 2800,
      durationMin: 45,
      branchIds: [],
      searchTerms: ['hydra'],
      description: null,
      createdAt: '2026-10-09T10:00:00.000Z',
      updatedAt: '2026-10-09T11:30:00.000Z',
    }),
    offeringRecord({
      id: OFFERING_IDS.underarm,
      offeringNumber: 6,
      name: 'Underarm Peel · 6 sessions',
      category: 'package',
      tone: 'lav',
      price: 9000,
      offerPrice: null,
      minPrice: 0,
      sessions: 6,
      validityDays: 180,
      searchTerms: [],
      description: null,
      createdAt: '2026-10-08T10:00:00.000Z',
      updatedAt: '2026-10-08T10:00:00.000Z',
    }),
    offeringRecord(),
    offeringRecord({
      id: OFFERING_IDS.sunscreen,
      offeringNumber: 4,
      name: 'Sunscreen SPF 50',
      category: 'product',
      tone: 'sky',
      price: 850.5,
      offerPrice: null,
      minPrice: 0,
      branchIds: [],
      searchTerms: ['spf'],
      description: null,
      createdAt: '2026-10-05T10:00:00.000Z',
      updatedAt: '2026-10-05T10:00:00.000Z',
    }),
    offeringRecord({
      id: OFFERING_IDS.oldLaser,
      offeringNumber: 2,
      name: 'Old Laser Full Face',
      category: 'lhr',
      tone: 'stone',
      price: 4800,
      offerPrice: null,
      minPrice: 4000,
      branchIds: [ADAJAN_ID, VESU_ID],
      searchTerms: [],
      description: null,
      isActive: false,
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-21T10:00:00.000Z',
    }),
    offeringRecord({
      id: OFFERING_IDS.consultation,
      offeringNumber: 1,
      name: 'Consultation',
      category: 'consultation',
      tone: 'sky',
      price: 500,
      offerPrice: null,
      minPrice: 0,
      durationMin: 15,
      gstPercent: 0,
      branchIds: [],
      searchTerms: [],
      description: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    }),
  ];
}

/** The offers in the server's order: live, scheduled, paused, ended. */
export function offeringsTabOffers(): OfferRecord[] {
  return [
    offerRecord({
      name: 'Diwali glow',
      offeringIds: [OFFERING_IDS.researchPeel, OFFERING_IDS.hydra],
    }),
    offerRecord({
      id: OFFER_IDS.vesuLaunch,
      name: 'Vesu launch',
      code: null,
      kind: 'fixed',
      value: 1450,
      offeringIds: [OFFERING_IDS.researchPeel],
      branchIds: [VESU_ID],
      tone: 'sky',
    }),
    offerRecord({
      id: OFFER_IDS.bringAFriend,
      name: 'Bring a friend',
      code: null,
      kind: 'extra',
      value: 1,
      offeringIds: [OFFERING_IDS.underarm],
      tone: 'lav',
    }),
    offerRecord({
      id: OFFER_IDS.monsoon,
      name: 'Monsoon',
      code: 'MONSOON',
      value: 10,
      offeringIds: [OFFERING_IDS.consultation],
      isActive: false,
      status: 'paused',
      tone: 'sage',
    }),
  ];
}

/** What the doubles answer from and write to. */
export interface OfferingsTabWorld {
  offerings: OfferingRecord[];
  offers: OfferRecord[];
  /** Deleted offerings, restorable. */
  removed: OfferingRecord[];
}

/** A fresh world: the catalogue and its offers, nothing removed. */
export function seededOfferingsTabWorld(): OfferingsTabWorld {
  return {
    offerings: offeringsTabCatalogue(),
    offers: offeringsTabOffers(),
    removed: [],
  };
}

/**
 * The reads and writes of `@/shared/api/clinic/offerings-api.ts` the tab calls, over an
 * {@link OfferingsTabWorld}: a later read shows a write; an unknown id is a 404.
 */
export function offeringsApiDouble(world: OfferingsTabWorld) {
  return {
    fetchAllOfferings: vi.fn(async () => structuredClone(world.offerings)),
    fetchAllOffers: vi.fn(async () => structuredClone(world.offers)),
    fetchOffering: vi.fn(async (offeringId: string) => {
      const offering = world.offerings.find((entry) => entry.id === offeringId);
      if (!offering) {
        throw new HttpError('Not found', 404, `/app/offerings/${offeringId}`, 'GET');
      }
      return structuredClone(offering);
    }),
    deleteOffering: vi.fn(
      async ({
        offeringId,
      }: {
        offeringId: string;
        reason: string;
        note: string | null;
      }) => {
        const offering = world.offerings.find((entry) => entry.id === offeringId);
        if (!offering) {
          throw new HttpError('Not found', 404, `/app/offerings/${offeringId}`, 'DELETE');
        }
        world.offerings = world.offerings.filter((entry) => entry.id !== offeringId);
        world.removed = [...world.removed, offering];
      },
    ),
    restoreOffering: vi.fn(async (offeringId: string, _idempotencyKey: string) => {
      const offering = world.removed.find((entry) => entry.id === offeringId);
      if (!offering) {
        throw new HttpError(
          'Not found',
          404,
          `/app/offerings/${offeringId}/restore`,
          'POST',
        );
      }
      world.removed = world.removed.filter((entry) => entry.id !== offeringId);
      world.offerings = [...world.offerings, offering].sort(
        (a, b) => b.offeringNumber - a.offeringNumber,
      );
      return structuredClone(offering);
    }),
  };
}
