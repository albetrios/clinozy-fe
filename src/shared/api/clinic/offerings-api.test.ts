import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { clinicToday } from './clinic-time.ts';
import { branchRef } from './fixtures/organization.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  compareOffersForList,
  createOffer,
  createOffering,
  deleteOffer,
  deleteOffering,
  fetchAllOfferings,
  fetchAllOffers,
  fetchOffer,
  fetchOffering,
  listOfferings,
  listOffers,
  offeringMatchesSearch,
  offerMatchesSearch,
  restoreOffer,
  restoreOffering,
  setOfferPaused,
  updateOffer,
  updateOffering,
} from './offerings-api.ts';

const NAVRATRI = ref.offer(31);
const LHR_LAUNCH = ref.offer(30);
const PEEL_PACK = ref.offer(29);
const MONSOON = ref.offer(28);

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (
    error.data as { error: { code: string; detail: string; fields?: object } }
  ).error;
  return { status: error.status, ...body };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T04:30:00Z'));
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the offerings list (listOfferings, S:1734)', () => {
  it('reads one page of live offerings, last updated first', async () => {
    const page = await listOfferings();
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((row) => row.seq)).toEqual([
      274, 273, 272, 271, 270, 268, 267, 266, 265, 264, 263,
    ]);
  });

  it('filters by category and specialty', async () => {
    const packages = await listOfferings({ category: 'package' });
    expect(packages.items.map((row) => row.seq)).toEqual([273, 268, 263]);
    const dental = await listOfferings({ specialty: 'dental' });
    expect(dental.items.map((row) => row.name)).toEqual(['Scaling & Polishing']);
  });

  it('searches the name, the search terms and "#id" (H:5454)', async () => {
    await updateOffering(ref.offering(270), { searchTerms: ['foot', 'callus'] });
    const seqs = async (q: string) =>
      (await listOfferings({ q })).items.map((row) => row.seq);
    expect(await seqs('lhr')).toEqual([268, 267, 266]);
    expect(await seqs('CALLUS')).toEqual([270]);
    expect(await seqs('#265')).toEqual([265]);
    expect(await seqs('  ')).toHaveLength(11);
  });

  it('sorts by name, price or category, ascending unless told otherwise', async () => {
    const byPrice = await listOfferings({ sort: 'price' });
    expect(byPrice.items.slice(0, 3).map((row) => row.seq)).toEqual([265, 266, 270]);
    const priciest = await listOfferings({ sort: 'price', order: 'desc' });
    expect(priciest.items[0]?.seq).toBe(273);
    const byName = await listOfferings({ sort: 'name' });
    expect(byName.items[0]?.name).toBe('B1G1 D-Tan Facial');
    const byCategory = await listOfferings({ sort: 'category' });
    expect(byCategory.items[0]?.category).toBe('consultation');
  });

  it('reads every cursor page when the catalogue outgrows one', async () => {
    for (let index = 0; index < 45; index += 1) {
      await createOffering({
        name: `Extra offering ${String.fromCharCode(65 + (index % 26))}${index}`,
        price: 10000,
      });
    }
    const firstPage = await listOfferings();
    expect(firstPage.items).toHaveLength(50);
    expect(firstPage.nextCursor).not.toBeNull();
    const all = await fetchAllOfferings();
    expect(all).toHaveLength(56);
    expect(new Set(all.map((row) => row.id)).size).toBe(56);
  });
});

describe('one offering', () => {
  it('reads it by id, and answers 404 for an unknown one', async () => {
    expect((await fetchOffering(ref.offering(274))).name).toBe('B1G1 D-Tan Facial');
    expect((await failureOf(fetchOffering(ref.offering(1)))).status).toBe(404);
  });
});

describe('createOffering (S:1739)', () => {
  it('creates a fresh record from the name and price — the defaults, never a copy', async () => {
    const created = await createOffering({ name: 'Hydra facial', price: 250000 });
    expect(created).toMatchObject({
      seq: 275,
      name: 'Hydra facial',
      price: 250000,
      category: 'treatment',
      specialty: 'skin',
      tone: 'sage',
      offerPrice: null,
      minPrice: 0,
      durationMin: 30,
      sessions: 1,
      validityDays: 0,
      gstPct: 0,
      gstInclusive: false,
      active: true,
      branchIds: [],
      searchTerms: [],
      description: null,
      deletedAt: null,
    });
    expect((await fetchAllOfferings()).map((row) => row.seq)).toContain(275);
  });

  it('keeps an offer price below the price, and bills the list price when it is empty or equal', async () => {
    const below = await createOffering({
      name: 'Peel A',
      price: 150000,
      offerPrice: 120000,
    });
    expect(below.offerPrice).toBe(120000);
    const equal = await createOffering({
      name: 'Peel B',
      price: 150000,
      offerPrice: 150000,
    });
    expect(equal.offerPrice).toBeNull();
    const zero = await createOffering({ name: 'Peel C', price: 150000, offerPrice: 0 });
    expect(zero.offerPrice).toBeNull();
  });

  it('trims the name, drops blank search terms and keeps no empty description', async () => {
    const created = await createOffering({
      name: '  Glow peel  ',
      price: 90000,
      searchTerms: ['glow', ' ', 'peel '],
      description: '   ',
      category: undefined,
    });
    expect(created).toMatchObject({
      name: 'Glow peel',
      searchTerms: ['glow', 'peel'],
      description: null,
      category: 'treatment',
    });
  });

  it('refuses an offer price above the price, and a lowest price above the offer price (422)', async () => {
    const above = await failureOf(
      createOffering({ name: 'Peel D', price: 100000, offerPrice: 120000 }),
    );
    expect(above).toMatchObject({
      status: 422,
      code: 'validation',
      detail: 'Offer price can’t be above the price',
    });
    expect(above.fields).toHaveProperty('offerPrice');
    const floor = await failureOf(
      createOffering({
        name: 'Peel E',
        price: 100000,
        offerPrice: 80000,
        minPrice: 90000,
      }),
    );
    expect(floor.fields).toEqual({
      minPrice: ['Lowest price can’t be above the offer price'],
    });
  });

  it('refuses an empty name and the contract ranges (422)', async () => {
    const empty = await failureOf(createOffering({ name: '   ', price: 1000 }));
    expect(empty).toMatchObject({ status: 422, detail: 'Add a name' });
    const ranges = await failureOf(
      createOffering({ name: 'Peel F', price: 1000, sessions: 0, gstPct: 120 }),
    );
    expect(Object.keys(ranges.fields ?? {}).sort()).toEqual(['gstPct', 'sessions']);
  });

  it('accepts any GST rate up to 100 (Appendix F)', async () => {
    const created = await createOffering({
      name: 'Sunscreen',
      price: 45000,
      gstPct: 2.5,
    });
    expect(created.gstPct).toBe(2.5);
  });

  it('refuses a taken name, whatever its case (409), and a branch the clinic lacks (422)', async () => {
    const taken = await failureOf(createOffering({ name: 'back PEELING', price: 1000 }));
    expect(taken).toMatchObject({ status: 409, code: 'conflict' });
    expect(taken.fields).toHaveProperty('name');
    const branch = await failureOf(
      createOffering({ name: 'Peel G', price: 1000, branchIds: [ref.offering(1)] }),
    );
    expect(branch).toMatchObject({ status: 422 });
    expect(branch.fields).toHaveProperty('branchIds');
  });
});

describe('updateOffering (S:1739)', () => {
  it('merges the patch and keeps the rest', async () => {
    const saved = await updateOffering(ref.offering(272), {
      price: 160000,
      branchIds: [branchRef('Vesu')],
    });
    expect(saved).toMatchObject({
      seq: 272,
      name: 'Underarm Peel',
      price: 160000,
      active: false,
    });
    expect(saved.branchIds).toEqual([branchRef('Vesu')]);
  });

  it('checks the merged record — a price under the saved offer price is refused', async () => {
    // #274 bills ₹1,200 against ₹1,500.
    const failure = await failureOf(updateOffering(ref.offering(274), { price: 100000 }));
    expect(failure).toMatchObject({ status: 422 });
    expect(failure.fields).toHaveProperty('offerPrice');
  });

  it('lets an offering keep its own name but not take another (409)', async () => {
    const same = await updateOffering(ref.offering(271), { name: 'Back Peeling' });
    expect(same.name).toBe('Back Peeling');
    const taken = await failureOf(
      updateOffering(ref.offering(271), { name: 'corn removal' }),
    );
    expect(taken.status).toBe(409);
  });

  it('answers 404 for a deleted offering', async () => {
    await deleteOffering(ref.offering(270), 'duplicate', null);
    expect(
      (await failureOf(updateOffering(ref.offering(270), { price: 1 }))).status,
    ).toBe(404);
  });
});

describe('deleteOffering and restoreOffering (S:1546)', () => {
  it('soft-deletes with the reason, hides the offering, and restores it', async () => {
    const removed = await deleteOffering(
      ref.offering(272),
      'not_needed',
      'Replaced by #273',
    );
    expect(removed).toMatchObject({
      deleteReason: 'not_needed',
      deleteNote: 'Replaced by #273',
    });
    expect((await fetchAllOfferings()).map((row) => row.seq)).not.toContain(272);
    // Offers keep naming it, so Undo puts everything back.
    expect((await fetchOffer(NAVRATRI)).offeringIds).toContain(ref.offering(272));
    const restored = await restoreOffering(ref.offering(272));
    expect(restored.deletedAt).toBeNull();
    expect((await fetchAllOfferings()).map((row) => row.seq)).toContain(272);
  });

  it('refuses "Other" without a note (422 on the note)', async () => {
    const failure = await failureOf(deleteOffering(ref.offering(272), 'other', ' '));
    expect(failure.status).toBe(422);
    expect(failure.fields).toHaveProperty('note');
  });
});

describe('the offers list (listOffers, S:1735)', () => {
  it('reads every live offer, the latest start first', async () => {
    const all = await fetchAllOffers();
    expect(all.map((offer) => offer.id)).toEqual([
      PEEL_PACK,
      NAVRATRI,
      LHR_LAUNCH,
      MONSOON,
    ]);
  });

  it('filters by the derived state on the clinic’s today', async () => {
    const ids = async (state: 'live' | 'scheduled' | 'paused' | 'ended') =>
      (await listOffers({ state })).items.map((offer) => offer.id);
    expect(await ids('live')).toEqual([NAVRATRI, LHR_LAUNCH]);
    expect(await ids('scheduled')).toEqual([PEEL_PACK]);
    expect(await ids('ended')).toEqual([MONSOON]);
    expect(await ids('paused')).toEqual([]);
    await setOfferPaused(LHR_LAUNCH, true);
    expect(await ids('paused')).toEqual([LHR_LAUNCH]);
  });

  it('searches the name, the code and the offerings’ names (H:5476)', async () => {
    const ids = async (q: string) =>
      (await listOffers({ q })).items.map((offer) => offer.id);
    expect(await ids('glow20')).toEqual([NAVRATRI]);
    expect(await ids('rain')).toEqual([MONSOON]);
    expect(await ids('back peeling')).toEqual([NAVRATRI, MONSOON]);
    expect(await ids('monsoon')).toEqual([MONSOON]);
  });

  it('orders the Offers tab Running → Scheduled → Paused → Ended, newest first in each', async () => {
    await setOfferPaused(NAVRATRI, true);
    const today = clinicToday();
    const ordered = [...(await fetchAllOffers())].sort(compareOffersForList(today));
    expect(ordered.map((offer) => offer.id)).toEqual([
      LHR_LAUNCH,
      PEEL_PACK,
      NAVRATRI,
      MONSOON,
    ]);
    const second = await createOffer({
      name: 'Diwali glow',
      offeringIds: [ref.offering(274)],
    });
    const running = [...(await fetchAllOffers())].sort(compareOffersForList(today));
    expect(running.slice(0, 2).map((offer) => offer.id)).toEqual([second.id, LHR_LAUNCH]);
  });
});

describe('createOffer and updateOffer (S:1740)', () => {
  it('creates from the name and offerings with the defaults, and no display id', async () => {
    const created = await createOffer({
      name: 'Diwali glow',
      offeringIds: [ref.offering(271)],
    });
    expect(created).toMatchObject({
      name: 'Diwali glow',
      code: null,
      kind: 'percent',
      value: 10,
      branchIds: [],
      startsOn: null,
      endsOn: null,
      paused: false,
      tone: 'blush',
      note: null,
    });
    expect(created).not.toHaveProperty('seq');
    expect((await fetchOffer(created.id)).name).toBe('Diwali glow');
  });

  it('upper-cases the code without spaces, and keeps an empty one as none', async () => {
    const coded = await createOffer({
      name: 'A',
      offeringIds: [ref.offering(271)],
      code: 'diwali 25',
    });
    expect(coded.code).toBe('DIWALI25');
    const plain = await createOffer({
      name: 'B',
      offeringIds: [ref.offering(271)],
      code: '  ',
    });
    expect(plain.code).toBeNull();
  });

  it.each([
    ['percent', 0, 'Set the discount'],
    ['percent', 101, 'Set the discount'],
    ['amount', 0, 'Set the amount'],
    ['fixed', 0, 'Set the amount'],
    ['extra', 21, 'Set the free sessions'],
  ] as const)('refuses a %s value of %i — "%s"', async (kind, value, message) => {
    const failure = await failureOf(
      createOffer({ name: 'C', offeringIds: [ref.offering(271)], kind, value }),
    );
    expect(failure).toMatchObject({ status: 422, detail: message });
  });

  it('refuses no offerings, an end before the start, and unknown offerings or branches', async () => {
    expect((await failureOf(createOffer({ name: 'D', offeringIds: [] }))).detail).toBe(
      'Pick at least one offering',
    );
    const dates = await failureOf(
      createOffer({
        name: 'E',
        offeringIds: [ref.offering(271)],
        startsOn: '2026-10-10',
        endsOn: '2026-10-09',
      }),
    );
    expect(dates).toMatchObject({
      status: 422,
      fields: { endsOn: ['Ends before it starts'] },
    });
    expect(
      (await failureOf(createOffer({ name: 'F', offeringIds: [ref.offering(1)] })))
        .fields,
    ).toHaveProperty('offeringIds');
    expect(
      (
        await failureOf(
          createOffer({
            name: 'G',
            offeringIds: [ref.offering(271)],
            branchIds: [ref.offer(1)],
          }),
        )
      ).fields,
    ).toHaveProperty('branchIds');
  });

  it('refuses a code another offer uses (409), but not the offer’s own', async () => {
    const taken = await failureOf(
      createOffer({ name: 'H', offeringIds: [ref.offering(271)], code: 'GLOW20' }),
    );
    expect(taken).toMatchObject({ status: 409, code: 'conflict' });
    const own = await updateOffer(NAVRATRI, { code: 'GLOW20', note: 'Festival offer' });
    expect(own.code).toBe('GLOW20');
  });

  it('checks the merged record and pauses or resumes', async () => {
    const failure = await failureOf(updateOffer(MONSOON, { endsOn: '2026-01-01' }));
    expect(failure.fields).toHaveProperty('endsOn');
    expect((await setOfferPaused(NAVRATRI, true)).paused).toBe(true);
    expect((await setOfferPaused(NAVRATRI, false)).paused).toBe(false);
  });
});

describe('deleteOffer and restoreOffer (S:1546)', () => {
  it('soft-deletes with the reason and restores', async () => {
    await deleteOffer(MONSOON, 'not_needed', null);
    expect((await fetchAllOffers()).map((offer) => offer.id)).not.toContain(MONSOON);
    expect((await failureOf(fetchOffer(MONSOON))).status).toBe(404);
    await restoreOffer(MONSOON);
    expect((await fetchOffer(MONSOON)).deletedAt).toBeNull();
  });

  it('refuses "Other" without a note (422)', async () => {
    expect((await failureOf(deleteOffer(MONSOON, 'other', null))).status).toBe(422);
  });
});

describe('the search matchers', () => {
  it('matches an offering by name, term or #id, ignoring case and edges', () => {
    const peel = { name: 'Underarm Peel', searchTerms: ['armpit'], seq: 272 };
    expect(offeringMatchesSearch(peel, ' ARMPIT ')).toBe(true);
    expect(offeringMatchesSearch(peel, '#272')).toBe(true);
    expect(offeringMatchesSearch(peel, 'laser')).toBe(false);
  });

  it('matches an offer by name, code or an offering’s name', () => {
    const offer = { name: 'Navratri glow', code: 'GLOW20', offeringIds: ['a', 'b'] };
    const names = (id: string) => ({ a: 'Back Peeling' })[id];
    expect(offerMatchesSearch(offer, 'glow20', names)).toBe(true);
    expect(offerMatchesSearch(offer, 'peeling', names)).toBe(true);
    expect(offerMatchesSearch({ ...offer, code: null }, 'facial', names)).toBe(false);
  });
});

describe('the fixture world behind it', () => {
  it('keeps the offers collection free of display ids', () => {
    expect(clinicFixtures.offers.snapshot().every((offer) => !('seq' in offer))).toBe(
      true,
    );
  });

  it('seeds only records the save rules accept — each saves unchanged', async () => {
    for (const offering of clinicFixtures.offerings.snapshot()) {
      const saved = await updateOffering(offering.id, {});
      expect(saved, `#${offering.seq}`).toEqual({
        ...offering,
        updatedAt: saved.updatedAt,
      });
    }
    for (const offer of clinicFixtures.offers.snapshot()) {
      const saved = await updateOffer(offer.id, {});
      expect(saved, offer.name).toEqual({ ...offer, updatedAt: saved.updatedAt });
    }
  });
});
