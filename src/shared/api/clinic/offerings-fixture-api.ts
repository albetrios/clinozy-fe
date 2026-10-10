import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import {
  clinicHttpError,
  compareText,
  definedFields,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import {
  OFFERING_DEFAULTS,
  type OfferingCreateInput,
  offeringInputSchema,
  type OfferingRecord,
  type OfferRecord,
} from './offerings-fixture-contracts.ts';

/*
 * The fixture world's offerings and offers, for the rooms still on fixtures: the Invoice
 * drawer reads both whole and its stacked "New offering" creates one. The Offerings room itself
 * reads clinozy-be (`offerings-api.ts`); this module goes with the last fixture room that reads
 * an offering. The world is imported on demand, so its seed data never lands in a route chunk.
 */

/** TanStack Query keys for the fixture catalogue — apart from clinozy-be's (`offeringQueryKeys`). */
export const fixtureOfferingQueryKeys = {
  all: ['clinic', 'fixture-offerings'] as const,
  offerings: () => [...fixtureOfferingQueryKeys.all, 'offerings'] as const,
  offers: () => [...fixtureOfferingQueryKeys.all, 'offers'] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

/** Every fixture offering, active or not, the latest saved first — each page in turn. */
export function fetchFixtureOfferings(): Promise<OfferingRecord[]> {
  return collectAllPages(async (cursor) => {
    const { clinicFixtures } = await fixtureWorld();
    const page = await clinicFixtures.offerings.list({
      sort: (a, b) => compareText(b.updatedAt, a.updatedAt) || b.seq - a.seq,
      cursor,
    });
    return { rows: page.items, next: page.nextCursor };
  }, 'fixture-offerings');
}

/** Every fixture offer, in any state, the latest start first (an open start last). */
export function fetchFixtureOffers(): Promise<OfferRecord[]> {
  return collectAllPages(async (cursor) => {
    const { clinicFixtures } = await fixtureWorld();
    const page = await clinicFixtures.offers.list({
      sort: (a, b) =>
        compareText(b.startsOn ?? '', a.startsOn ?? '') ||
        compareText(b.createdAt, a.createdAt),
      cursor,
    });
    return { rows: page.items, next: page.nextCursor };
  }, 'fixture-offers');
}

/** Refuse what the contract's server refuses: a taken name (`S:1739`) and unknown branches. */
async function checkOffering(fields: { name: string; branchIds: string[] }) {
  const { clinicFixtures } = await fixtureWorld();
  const name = fields.name.toLowerCase();
  const taken = clinicFixtures.offerings.snapshot(
    (offering) => offering.name.trim().toLowerCase() === name,
  );
  if (taken.length > 0) {
    const message = 'An offering with this name already exists';
    throw clinicHttpError(409, 'conflict', message, { name: [message] });
  }
  refuseUnknownIds(
    'branchIds',
    fields.branchIds,
    clinicFixtures.branches.snapshot(),
    'Pick branches the clinic has',
  );
}

/**
 * Create a fixture offering — the stacked "New offering" over the Invoice drawer — from the
 * name and price plus whatever else is set, the rest from {@link OFFERING_DEFAULTS}, the
 * specialty the clinic's first (Q-O6). A 422 names a broken rule, a 409 a taken name.
 */
export async function createFixtureOffering(
  input: OfferingCreateInput,
): Promise<OfferingRecord> {
  const { clinicFixtures, clinicOrganization } = await fixtureWorld();
  const fields = validateClinicInput(offeringInputSchema, {
    ...OFFERING_DEFAULTS,
    specialty: clinicOrganization().specialties[0] ?? 'skin',
    ...definedFields(input),
  });
  await checkOffering(fields);
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  return clinicFixtures.offerings.create({ ...fields, updatedById: FIXTURE_VIEWER_ID });
}
