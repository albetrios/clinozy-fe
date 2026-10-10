import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  createFixtureOffering,
  fetchFixtureOfferings,
  fetchFixtureOffers,
} from './offerings-fixture-api.ts';

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('the fixture catalogue the Invoice drawer still reads', () => {
  it('reads every offering, the latest saved first, without a default doctor or room', async () => {
    const offerings = await fetchFixtureOfferings();
    expect(offerings).toHaveLength(11);
    expect(offerings[0]?.seq).toBe(274);
    expect(offerings.find((offering) => offering.seq === 272)?.active).toBe(false);
    for (const offering of offerings) {
      expect(offering).not.toHaveProperty('defaultDoctorId');
      expect(offering).not.toHaveProperty('room');
    }
  });

  it('reads every offer, the latest start first', async () => {
    const offers = await fetchFixtureOffers();
    expect(offers.map((offer) => offer.id)).toEqual([
      ref.offer(29),
      ref.offer(31),
      ref.offer(30),
      ref.offer(28),
    ]);
  });

  it('creates the stacked "New offering" from the defaults, in paise', async () => {
    const created = await createFixtureOffering({ name: 'Hydra facial', price: 249_900 });
    expect(created).toMatchObject({
      name: 'Hydra facial',
      price: 249_900,
      category: 'treatment',
      durationMin: 30,
      active: true,
      offerPrice: null,
      specialty: 'skin',
    });
    expect(clinicFixtures.offerings.snapshot()).toHaveLength(12);
  });

  it('refuses a name another offering has, in any case', async () => {
    await expect(
      createFixtureOffering({ name: 'b1g1 d-tan facial', price: 100_000 }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
