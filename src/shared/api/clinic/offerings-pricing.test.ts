import { describe, expect, it } from 'vitest';

import { PROTOTYPE_SEED_DAY } from './clinic-fixture-seed.ts';
import { offeringSeed, offerSeed } from './fixtures/offerings.fixtures.ts';
import { type BranchName, branchRef } from './fixtures/organization.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import type { OfferingRecord, OfferRecord } from './offerings-contracts.ts';
import {
  basePrice,
  clampToFloor,
  effectivePrice,
  invoiceLineRate,
  offerAppliesAt,
  offerPreview,
  offerState,
  pricingBranch,
} from './offerings-pricing.ts';

/*
 * The seeds are taken on the prototype's own seed day, so their dates are the
 * prototype's literal dates (`OFX_SEED`, H:3583–3587) and the oracle below can
 * read them unchanged.
 */
const SEED_DAY = PROTOTYPE_SEED_DAY;
const OFFERINGS = offeringSeed(SEED_DAY);
const OFFERS = offerSeed(SEED_DAY);
const BRANCHES: readonly (BranchName | null)[] = [null, 'Adajan', 'Vesu', 'Varachha'];

const offering = (seq: number): OfferingRecord => {
  const found = OFFERINGS.find((row) => row.seq === seq);
  if (!found) throw new Error(`no offering #${seq}`);
  return found;
};
const offer = (key: number): OfferRecord => {
  const found = OFFERS.find((row) => row.id === ref.offer(key));
  if (!found) throw new Error(`no offer ${key}`);
  return found;
};
const branchIdOf = (name: BranchName | null) => (name ? branchRef(name) : null);
const rupees = (paise: number) => paise / 100;

// ── The prototype, verbatim, as the oracle (rupees; H:3550–3589) ──

interface ProtoOffering {
  id: number;
  price: number;
  offer: number;
  min: number;
}
interface ProtoOffer {
  id: number;
  kind: 'pct' | 'amt' | 'fixed' | 'extra';
  val: number;
  ofs: number[];
  brs: BranchName[];
  from: string;
  to: string;
  paused: boolean;
}

/** `OF_SEED` price, `offer` and `min` (H:3550–3562). */
const PROTO_OFFERINGS: ProtoOffering[] = [
  [274, 1500],
  [273, 9000],
  [272, 1500],
  [271, 3000],
  [270, 1000],
  [268, 4800],
  [267, 8500],
  [266, 850],
  [265, 300],
  [264, 1800],
  [263, 6400],
].map(([id = 0, price = 0]) => ({
  id,
  price,
  offer:
    ({ 274: 1200, 273: 7500, 268: 4200, 267: 7200, 264: 1500 } as Record<number, number>)[
      id
    ] || price,
  min: price >= 1000 ? Math.round((price * 0.75) / 50) * 50 : price,
}));

/** `OFX_SEED` (H:3583–3587), its dates as `pdS` reads them. */
const PROTO_OFFERS: ProtoOffer[] = [
  {
    id: 31,
    kind: 'pct',
    val: 20,
    ofs: [274, 271, 272],
    brs: ['Adajan', 'Vesu'],
    from: '2026-09-22',
    to: '2026-10-02',
    paused: false,
  },
  {
    id: 30,
    kind: 'fixed',
    val: 3999,
    ofs: [268],
    brs: ['Vesu'],
    from: '2026-09-01',
    to: '2026-10-31',
    paused: false,
  },
  {
    id: 29,
    kind: 'extra',
    val: 1,
    ofs: [273],
    brs: [],
    from: '2026-10-01',
    to: '2026-10-31',
    paused: false,
  },
  {
    id: 28,
    kind: 'amt',
    val: 500,
    ofs: [271, 264],
    brs: [],
    from: '2026-07-01',
    to: '2026-08-31',
    paused: false,
  },
];

/** `ofxState` (H:3588) with the day passed in. */
function protoState(x: ProtoOffer, t: string) {
  if (x.paused) return 'Paused';
  if (x.from && t < x.from) return 'Scheduled';
  if (x.to && t > x.to) return 'Ended';
  return 'Running';
}

/** `ofEff`'s per-offer price: `pct` → `amt` → else fixed (H:3589). */
function protoPrice(x: ProtoOffer, base: number) {
  if (x.kind === 'pct') return Math.round(base * (1 - (+x.val || 0) / 100));
  if (x.kind === 'amt') return Math.max(0, base - (+x.val || 0));
  return Math.min(base, +x.val || base);
}

/** `ofEff` (H:3589) with the day passed in. */
function protoEff(
  o: ProtoOffering,
  br: BranchName | null,
  list: ProtoOffer[],
  t: string,
) {
  const L = +o.price || 0;
  const base = +o.offer && +o.offer < L ? +o.offer : L;
  const X = list.filter(
    (x) =>
      protoState(x, t) === 'Running' &&
      x.ofs.includes(o.id) &&
      (br === null || x.brs.length === 0 || x.brs.includes(br)),
  );
  let fin = base;
  let promo: ProtoOffer | null = null;
  let extra = 0;
  let xp: ProtoOffer | null = null;
  for (const x of X) {
    if (x.kind === 'extra') {
      if ((+x.val || 0) > extra) {
        extra = +x.val || 0;
        xp = x;
      }
      continue;
    }
    const v = protoPrice(x, base);
    if (v < fin) {
      fin = v;
      promo = x;
    }
  }
  const fl = +o.min || 0;
  if (fl && fin < fl) fin = fl;
  return {
    list: L,
    offer: base,
    fin,
    promo: promo || xp,
    extra,
    off: L ? Math.round((1 - fin / L) * 100) : 0,
  };
}

/** Days that put every seed offer in every state: before, in, on the edges of and after each window. */
const DAYS = [
  '2026-06-30',
  '2026-07-01',
  '2026-08-31',
  '2026-09-01',
  '2026-09-22',
  SEED_DAY,
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-31',
  '2026-11-01',
];

describe('offerState (ofxState, H:3588)', () => {
  const window = { paused: false, startsOn: '2026-10-01', endsOn: '2026-10-31' };

  it.each([
    ['the day before the start', '2026-09-30', 'scheduled'],
    ['the start day', '2026-10-01', 'live'],
    ['inside the window', '2026-10-15', 'live'],
    ['the end day', '2026-10-31', 'live'],
    ['the day after the end', '2026-11-01', 'ended'],
  ] as const)('is %s → %s', (_label, today, state) => {
    expect(offerState(window, today)).toBe(state);
  });

  it('is paused whatever the dates say', () => {
    expect(offerState({ ...window, paused: true }, '2026-10-15')).toBe('paused');
    expect(offerState({ ...window, paused: true }, '2026-12-01')).toBe('paused');
  });

  it('never schedules an open start ("Now") nor ends an open end ("no end")', () => {
    expect(
      offerState({ paused: false, startsOn: null, endsOn: '2026-10-31' }, '2020-01-01'),
    ).toBe('live');
    expect(
      offerState({ paused: false, startsOn: '2026-10-01', endsOn: null }, '2099-01-01'),
    ).toBe('live');
    expect(offerState({ paused: false, startsOn: null, endsOn: null }, SEED_DAY)).toBe(
      'live',
    );
  });

  it('reads the seeds on the seed day: two running, one scheduled, one ended', () => {
    expect([31, 30, 29, 28].map((key) => offerState(offer(key), SEED_DAY))).toEqual([
      'live',
      'live',
      'scheduled',
      'ended',
    ]);
  });

  it('matches the prototype for every seed offer on every day, paused or not', () => {
    const STATE = {
      Running: 'live',
      Scheduled: 'scheduled',
      Paused: 'paused',
      Ended: 'ended',
    } as const;
    for (const proto of PROTO_OFFERS) {
      for (const paused of [false, true]) {
        for (const day of DAYS) {
          expect(
            offerState({ ...offer(proto.id), paused }, day),
            `${proto.id} ${day}`,
          ).toBe(STATE[protoState({ ...proto, paused }, day)]);
        }
      }
    }
  });
});

describe('effectivePrice (ofEff, H:3589, Q-O2)', () => {
  /** On the seed day: [final, % off, winning offer] per header branch. */
  type Expected = readonly [number, number, string | null];
  const SEED_DAY_PRICES: ReadonlyArray<
    readonly [number, Expected, Expected, Expected, Expected]
  > = [
    //  #     no single branch            Adajan                       Vesu                          Varachha
    [
      274,
      [1150, 23, 'Navratri glow'],
      [1150, 23, 'Navratri glow'],
      [1150, 23, 'Navratri glow'],
      [1200, 20, null],
    ],
    [273, [7500, 17, null], [7500, 17, null], [7500, 17, null], [7500, 17, null]],
    [
      272,
      [1200, 20, 'Navratri glow'],
      [1200, 20, 'Navratri glow'],
      [1200, 20, 'Navratri glow'],
      [1500, 0, null],
    ],
    [
      271,
      [2400, 20, 'Navratri glow'],
      [2400, 20, 'Navratri glow'],
      [2400, 20, 'Navratri glow'],
      [3000, 0, null],
    ],
    [270, [1000, 0, null], [1000, 0, null], [1000, 0, null], [1000, 0, null]],
    [
      268,
      [3999, 17, 'LHR launch · Vesu'],
      [4200, 13, null],
      [3999, 17, 'LHR launch · Vesu'],
      [4200, 13, null],
    ],
    [267, [7200, 15, null], [7200, 15, null], [7200, 15, null], [7200, 15, null]],
    [266, [850, 0, null], [850, 0, null], [850, 0, null], [850, 0, null]],
    [265, [300, 0, null], [300, 0, null], [300, 0, null], [300, 0, null]],
    [264, [1500, 17, null], [1500, 17, null], [1500, 17, null], [1500, 17, null]],
    [263, [6400, 0, null], [6400, 0, null], [6400, 0, null], [6400, 0, null]],
  ];

  it.each(SEED_DAY_PRICES)(
    'bills #%i on the seed day per header branch',
    (seq, ...perBranch) => {
      BRANCHES.forEach((branch, index) => {
        const price = effectivePrice(offering(seq), branchIdOf(branch), OFFERS, SEED_DAY);
        const [final, off, winner] = perBranch[index] ?? [];
        expect(
          [rupees(price.final), price.percentOff, price.winningOffer?.name ?? null],
          `#${seq} at ${branch ?? 'no single branch'}`,
        ).toEqual([final, off, winner]);
      });
    },
  );

  it('matches the prototype for every seed offering, branch and day, offers paused or not', () => {
    const pausedSets: ReadonlyArray<ReadonlySet<number>> = [
      new Set(),
      new Set([31]),
      new Set([30, 29]),
      new Set([31, 30, 29, 28]),
    ];
    let compared = 0;
    for (const paused of pausedSets) {
      const offers = OFFERS.map((row) => ({
        ...row,
        paused: [31, 30, 29, 28].some(
          (key) => paused.has(key) && row.id === ref.offer(key),
        ),
      }));
      const protoOffers = PROTO_OFFERS.map((row) => ({
        ...row,
        paused: paused.has(row.id),
      }));
      for (const proto of PROTO_OFFERINGS) {
        for (const branch of BRANCHES) {
          for (const day of DAYS) {
            const ours = effectivePrice(
              offering(proto.id),
              branchIdOf(branch),
              offers,
              day,
            );
            const theirs = protoEff(proto, branch, protoOffers, day);
            expect(
              {
                list: rupees(ours.list),
                base: rupees(ours.base),
                final: rupees(ours.final),
                off: ours.percentOff,
                extra: ours.extraSessions,
                promo: ours.winningOffer?.id ?? null,
              },
              `#${proto.id} at ${branch ?? 'no single branch'} on ${day}`,
            ).toEqual({
              list: theirs.list,
              base: theirs.offer,
              final: theirs.fin,
              off: theirs.off,
              extra: theirs.extra,
              promo: theirs.promo ? ref.offer(theirs.promo.id) : null,
            });
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(4 * 11 * 4 * DAYS.length);
  });

  it('adds the free session of a running extra offer — "₹7,500 · +1 free session · 17% below list"', () => {
    const price = effectivePrice(offering(273), null, OFFERS, '2026-10-05');
    expect(rupees(price.final)).toBe(7500);
    expect(price.extraSessions).toBe(1);
    expect(price.percentOff).toBe(17);
    expect(price.priceOffer).toBeNull();
    expect(price.extraOffer?.name).toBe('Peel pack + 1 free');
    expect(price.winningOffer?.name).toBe('Peel pack + 1 free');
  });

  const live = (
    key: number,
    patch: Partial<OfferRecord> & Pick<OfferRecord, 'kind' | 'value' | 'offeringIds'>,
  ): OfferRecord => ({
    ...offer(31),
    id: ref.offer(key),
    name: `Offer ${key}`,
    branchIds: [],
    startsOn: null,
    endsOn: null,
    paused: false,
    ...patch,
  });

  it('never stacks price offers — the lowest result wins', () => {
    const backPeeling = offering(271); // ₹3,000, floor ₹2,250
    const fiveHundredOff = live(90, {
      kind: 'amount',
      value: 50000,
      offeringIds: [backPeeling.id],
    });
    const tenPercent = live(91, {
      kind: 'percent',
      value: 10,
      offeringIds: [backPeeling.id],
    });
    const twentyPercent = live(92, {
      kind: 'percent',
      value: 20,
      offeringIds: [backPeeling.id],
    });

    const both = effectivePrice(
      backPeeling,
      null,
      [fiveHundredOff, tenPercent, twentyPercent],
      SEED_DAY,
    );
    expect(rupees(both.final)).toBe(2400); // 20% off, not 28% or ₹500 + 20%
    expect(both.winningOffer).toBe(twentyPercent);
  });

  it('keeps the earlier offer on a tie', () => {
    const peel = offering(272); // ₹1,500
    const first = live(93, { kind: 'amount', value: 30000, offeringIds: [peel.id] });
    const second = live(94, { kind: 'fixed', value: 120000, offeringIds: [peel.id] });
    expect(effectivePrice(peel, null, [first, second], SEED_DAY).winningOffer).toBe(
      first,
    );
    expect(effectivePrice(peel, null, [second, first], SEED_DAY).winningOffer).toBe(
      second,
    );
  });

  it('raises a price offer to the lowest price, keeping the offer that got there', () => {
    const backPeeling = offering(271); // ₹3,000, floor ₹2,250
    const thousandOff = live(95, {
      kind: 'amount',
      value: 100000,
      offeringIds: [backPeeling.id],
    });
    const price = effectivePrice(backPeeling, null, [thousandOff], SEED_DAY);
    expect(rupees(price.final)).toBe(2250);
    expect(price.percentOff).toBe(25);
    expect(price.winningOffer).toBe(thousandOff);
  });

  it('takes the most free sessions and combines them with the best price offer', () => {
    const pack = offering(273);
    const one = live(96, { kind: 'extra', value: 1, offeringIds: [pack.id] });
    const two = live(97, { kind: 'extra', value: 2, offeringIds: [pack.id] });
    const tenPercent = live(98, { kind: 'percent', value: 10, offeringIds: [pack.id] });
    const price = effectivePrice(pack, null, [one, tenPercent, two], SEED_DAY);
    expect(price.extraSessions).toBe(2);
    expect(price.extraOffer).toBe(two);
    expect(rupees(price.final)).toBe(6750); // ₹7,500 − 10%
    expect(price.priceOffer).toBe(tenPercent);
    expect(price.winningOffer).toBe(tenPercent);
  });

  it('rounds a percentage to the whole rupee, as the prototype does', () => {
    const draft = { id: 'draft', price: 135000, offerPrice: null, minPrice: 0 };
    const fifteen = live(99, { kind: 'percent', value: 15, offeringIds: ['draft'] });
    // ₹1,350 × 0.85 = ₹1,147.50 → ₹1,148, never 114750 paise.
    expect(effectivePrice(draft, null, [fifteen], SEED_DAY).final).toBe(114800);
    // 12.5% off rounds half up.
    expect(
      effectivePrice(offering(268), branchRef('Adajan'), OFFERS, SEED_DAY).percentOff,
    ).toBe(13);
  });

  it('applies a fixed price only below the base, and an amount never below zero', () => {
    const draft = { id: 'draft', price: 100000, offerPrice: null, minPrice: 0 };
    const above = live(80, { kind: 'fixed', value: 150000, offeringIds: ['draft'] });
    const huge = live(81, { kind: 'amount', value: 500000, offeringIds: ['draft'] });
    const fixedPrice = effectivePrice(draft, null, [above], SEED_DAY);
    expect(fixedPrice.final).toBe(100000);
    expect(fixedPrice.winningOffer).toBeNull();
    expect(effectivePrice(draft, null, [huge], SEED_DAY).final).toBe(0);
  });

  it('counts only running, undeleted offers that name this offering', () => {
    const peel = offering(272);
    const deleted = {
      ...live(82, { kind: 'percent', value: 50, offeringIds: [peel.id] }),
      deletedAt: '2026-09-27T05:00:00.000Z',
    };
    const elsewhere = live(83, {
      kind: 'percent',
      value: 50,
      offeringIds: [offering(270).id],
    });
    const ended = live(84, {
      kind: 'percent',
      value: 50,
      offeringIds: [peel.id],
      endsOn: '2026-09-01',
    });
    const paused = live(85, {
      kind: 'percent',
      value: 50,
      offeringIds: [peel.id],
      paused: true,
    });
    const price = effectivePrice(
      peel,
      null,
      [deleted, elsewhere, ended, paused],
      SEED_DAY,
    );
    expect(price.final).toBe(peel.price);
    expect(price.winningOffer).toBeNull();
  });

  it('prices an unsaved draft from its own fields, no offer naming it', () => {
    const draft = { id: null, price: 200000, offerPrice: 180000, minPrice: 0 };
    const everything = live(86, { kind: 'percent', value: 50, offeringIds: [] });
    const price = effectivePrice(draft, null, [everything], SEED_DAY);
    expect(price).toMatchObject({
      list: 200000,
      base: 180000,
      final: 180000,
      percentOff: 10,
    });
  });
});

describe('the pricing helpers', () => {
  it('bills the offer price only below the list price', () => {
    expect(basePrice({ price: 150000, offerPrice: 120000 })).toBe(120000);
    expect(basePrice({ price: 150000, offerPrice: null })).toBe(150000);
    expect(basePrice({ price: 150000, offerPrice: 150000 })).toBe(150000);
    expect(basePrice({ price: 150000, offerPrice: 160000 })).toBe(150000);
    expect(basePrice({ price: 150000, offerPrice: 0 })).toBe(150000);
  });

  it('raises to the floor, a floor of 0 meaning none', () => {
    expect(clampToFloor(96000, 115000)).toBe(115000);
    expect(clampToFloor(120000, 115000)).toBe(120000);
    expect(clampToFloor(0, 0)).toBe(0);
  });

  it('weighs a branch-limited offer only against one picked branch', () => {
    const vesuOnly = { branchIds: [branchRef('Vesu')] };
    expect(offerAppliesAt(vesuOnly, null)).toBe(true);
    expect(offerAppliesAt(vesuOnly, branchRef('Vesu'))).toBe(true);
    expect(offerAppliesAt(vesuOnly, branchRef('Adajan'))).toBe(false);
    expect(offerAppliesAt({ branchIds: [] }, branchRef('Varachha'))).toBe(true);
  });

  it('bills an inclusive price with its GST back-computed out of the rate (Q-O3)', () => {
    expect(invoiceLineRate(118_000, 18, false)).toBe(118_000);
    expect(invoiceLineRate(118_000, 18, true)).toBe(100_000);
    // ₹999 inclusive of 18%: the rate to the paisa, the line still ₹999.
    expect(invoiceLineRate(99_900, 18, true)).toBe(84_661);
    expect(invoiceLineRate(99_900, 0, true)).toBe(99_900);
  });

  it('prices for the header branch only when exactly one is picked (H:5453)', () => {
    expect(pricingBranch([])).toBeNull();
    expect(pricingBranch([branchRef('Vesu')])).toBe(branchRef('Vesu'));
    expect(pricingBranch([branchRef('Vesu'), branchRef('Adajan')])).toBeNull();
  });
});

describe('offerPreview (the Offer drawer boxes, H:5516)', () => {
  it('shows the base before and after one offer, never below the lowest price', () => {
    // #272: ₹1,500, floor ₹1,150 — 10% → ₹1,350; 30% → ₹1,050 → ₹1,150.
    expect(offerPreview(offering(272), { kind: 'percent', value: 10 })).toEqual({
      unit: 'price',
      before: 150000,
      after: 135000,
    });
    expect(offerPreview(offering(272), { kind: 'percent', value: 30 })).toEqual({
      unit: 'price',
      before: 150000,
      after: 115000,
    });
    // #274 bills its offer price, ₹1,200.
    expect(offerPreview(offering(274), { kind: 'fixed', value: 99900 })).toEqual({
      unit: 'price',
      before: 120000,
      after: 115000,
    });
    expect(offerPreview(offering(270), { kind: 'amount', value: 20000 })).toEqual({
      unit: 'price',
      before: 100000,
      after: 80000,
    });
  });

  it('shows sessions before and after an extra-sessions offer', () => {
    expect(offerPreview(offering(273), { kind: 'extra', value: 1 })).toEqual({
      unit: 'sessions',
      before: 6,
      after: 7,
    });
    expect(
      offerPreview({ ...offering(272), sessions: 0 }, { kind: 'extra', value: 2 }),
    ).toEqual({ unit: 'sessions', before: 1, after: 3 });
  });

  it('agrees with ofEff run on the one offer, as the prototype computes it', () => {
    for (const proto of PROTO_OFFERINGS) {
      for (const [kind, val] of [
        ['pct', 15],
        ['amt', 400],
        ['fixed', 999],
      ] as const) {
        const theirs = protoEff(
          proto,
          null,
          [
            {
              id: -1,
              kind,
              val,
              ofs: [proto.id],
              brs: [],
              from: '',
              to: '',
              paused: false,
            },
          ],
          SEED_DAY,
        );
        const ours = offerPreview(offering(proto.id), {
          kind: { pct: 'percent', amt: 'amount', fixed: 'fixed' }[
            kind
          ] as OfferRecord['kind'],
          value: kind === 'pct' ? val : val * 100,
        });
        expect([rupees(ours.before), rupees(ours.after)], `#${proto.id} ${kind}`).toEqual(
          [theirs.offer, theirs.fin],
        );
      }
    }
  });
});
