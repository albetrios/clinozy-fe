import { describe, expect, it } from 'vitest';

import { offeringRecord, offerRecord } from '@/tests/utils/offering-doubles.ts';

import type { OfferRecord, OfferStatus } from './offerings-contracts.ts';
import {
  basePrice,
  clampToFloor,
  effectivePrice,
  offerAppliesAt,
  offerPreview,
  pricingBranch,
} from './offerings-pricing.ts';

/*
 * The Offerings room's pricing on clinozy-be's units — rupees, and the server's `status` — held
 * to the prototype's `ofEff` (H:3589), which prices in rupees too: the oracle below runs it on
 * the same offerings and offers, each offer in each status.
 */

const VESU = 'brn_thsaog1i8bv6m9rd9ucoy';
const ADAJAN = 'brn_53j4b7hz7nfb0otr2d920';
const VARACHHA = 'brn_varachha00000000000a';
const offeringId = (seq: number) => `off_seq${String(seq).padStart(18, '0')}`;

/** `OF_SEED`'s price, offer and floor (H:3550–3562) — the prototype's rupees. */
const PROTO_OFFERINGS = [
  [274, 1500, 1200],
  [273, 9000, 7500],
  [272, 1500, 1500],
  [271, 3000, 3000],
  [270, 1000, 1000],
  [268, 4800, 4200],
  [267, 8500, 7200],
  [266, 850, 850],
  [265, 300, 300],
  [264, 1800, 1500],
].map(([id = 0, price = 0, offer = 0]) => ({
  id,
  price,
  offer,
  min: price >= 1000 ? Math.round((price * 0.75) / 50) * 50 : price,
}));

type ProtoKind = 'pct' | 'amt' | 'fixed' | 'extra';
interface ProtoOffer {
  id: number;
  kind: ProtoKind;
  val: number;
  ofs: number[];
  brs: string[];
}

/** `OFX_SEED` (H:3583–3587) with its branches as ids. */
const PROTO_OFFERS: ProtoOffer[] = [
  { id: 31, kind: 'pct', val: 20, ofs: [274, 271, 272], brs: [ADAJAN, VESU] },
  { id: 30, kind: 'fixed', val: 3999, ofs: [268], brs: [VESU] },
  { id: 29, kind: 'extra', val: 1, ofs: [273], brs: [] },
  { id: 28, kind: 'amt', val: 500, ofs: [271, 264], brs: [] },
];

const KINDS = { pct: 'percent', amt: 'amount', fixed: 'fixed', extra: 'extra' } as const;

/** `ofEff`'s per-offer price: `pct` → `amt` → else fixed (H:3589). */
function protoPrice(x: ProtoOffer, base: number) {
  if (x.kind === 'pct') return Math.round(base * (1 - x.val / 100));
  if (x.kind === 'amt') return Math.max(0, base - x.val);
  return Math.min(base, x.val || base);
}

/** Whether a running offer counts for this offering at this branch (H:3589). */
const protoApplies = (x: ProtoOffer, id: number, br: string | null) =>
  x.ofs.includes(id) && (br === null || x.brs.length === 0 || x.brs.includes(br));

/** `ofEff` (H:3589) over the offers the server calls running. */
function protoEff(
  o: (typeof PROTO_OFFERINGS)[number],
  br: string | null,
  running: ProtoOffer[],
) {
  const base = o.offer && o.offer < o.price ? o.offer : o.price;
  const counted = running.filter((x) => protoApplies(x, o.id, br));
  const extra = Math.max(
    0,
    ...counted.filter((x) => x.kind === 'extra').map((x) => x.val),
  );
  const prices = counted
    .filter((x) => x.kind !== 'extra')
    .map((x) => protoPrice(x, base));
  const fin = Math.max(Math.min(base, ...prices), o.min);
  return { base, fin, extra, off: Math.round((1 - fin / o.price) * 100) };
}

const liveOffering = (proto: (typeof PROTO_OFFERINGS)[number]) =>
  offeringRecord({
    id: offeringId(proto.id),
    price: proto.price,
    offerPrice: proto.offer === proto.price ? null : proto.offer,
    minPrice: proto.min,
  });

const liveOffer = (proto: ProtoOffer, status: OfferStatus): OfferRecord =>
  offerRecord({
    id: `ofr_proto${String(proto.id).padStart(16, '0')}`,
    kind: KINDS[proto.kind],
    value: proto.val,
    offeringIds: proto.ofs.map(offeringId),
    branchIds: proto.brs,
    status,
  });

const STATUSES: readonly OfferStatus[] = ['live', 'scheduled', 'paused', 'ended'];

describe('effectivePrice ("Billed today", ofEff, H:3589)', () => {
  it('matches the prototype for every offering, branch and status of every offer', () => {
    let compared = 0;
    // Each offer in each of the four statuses, one combination at a time.
    for (let mask = 0; mask < 4 ** PROTO_OFFERS.length; mask += 37) {
      const statuses = PROTO_OFFERS.map(
        (_offer, index) => STATUSES[Math.floor(mask / 4 ** index) % 4] ?? 'live',
      );
      const offers = PROTO_OFFERS.map((offer, index) =>
        liveOffer(offer, statuses[index] ?? 'live'),
      );
      const running = PROTO_OFFERS.filter((_offer, index) => statuses[index] === 'live');
      for (const proto of PROTO_OFFERINGS) {
        for (const branch of [null, ADAJAN, VESU, VARACHHA]) {
          const ours = effectivePrice(liveOffering(proto), branch, offers);
          const theirs = protoEff(proto, branch, running);
          expect(
            [ours.base, ours.final, ours.extraSessions, ours.percentOff],
            `#${proto.id} at ${branch ?? 'no single branch'}, ${statuses.join(' ')}`,
          ).toEqual([theirs.base, theirs.fin, theirs.extra, theirs.off]);
          compared += 1;
        }
      }
    }
    expect(compared).toBeGreaterThan(200);
  });

  it('counts an offer only while the server says it is live', () => {
    const peel = offeringRecord({ price: 2000, offerPrice: null, minPrice: 0 });
    for (const status of ['scheduled', 'paused', 'ended'] as const) {
      expect(effectivePrice(peel, null, [offerRecord({ status })]).final).toBe(2000);
    }
    const live = effectivePrice(peel, null, [offerRecord()]);
    expect(live).toMatchObject({ final: 1700, percentOff: 15 });
    expect(live.winningOffer?.name).toBe('Research Diwali glow');
  });

  it('takes an amount off to the paisa and never below zero', () => {
    const peel = offeringRecord({ price: 999.5, offerPrice: null, minPrice: 0 });
    const amount = (value: number) => offerRecord({ kind: 'amount', value });
    expect(effectivePrice(peel, null, [amount(250.25)]).final).toBe(749.25);
    expect(effectivePrice(peel, null, [amount(5000)]).final).toBe(0);
  });

  it('raises the price to a lowest price it can see, and to none it cannot (O15)', () => {
    const half = offerRecord({ value: 50 });
    // Research Peel bills ₹1,800; half off is ₹900, below its ₹1,500 floor.
    expect(effectivePrice(offeringRecord(), null, [half]).final).toBe(1500);
    expect(effectivePrice(offeringRecord({ minPrice: null }), null, [half]).final).toBe(
      900,
    );
    expect(effectivePrice(offeringRecord({ minPrice: 0 }), null, [half]).final).toBe(900);
  });

  it('never stacks price offers, keeps the earlier on a tie, and adds the most free sessions', () => {
    const peel = offeringRecord({ price: 2000, offerPrice: null, minPrice: 0 });
    const tenPercent = offerRecord({ id: 'ofr_ten000000000000000000', value: 10 });
    const twoHundredOff = offerRecord({
      id: 'ofr_amount00000000000000',
      kind: 'amount',
      value: 200,
    });
    const oneFree = offerRecord({
      id: 'ofr_extraone0000000000000',
      kind: 'extra',
      value: 1,
    });
    const twoFree = offerRecord({
      id: 'ofr_extratwo0000000000000',
      kind: 'extra',
      value: 2,
    });
    const price = effectivePrice(peel, null, [
      tenPercent,
      twoHundredOff,
      oneFree,
      twoFree,
    ]);
    expect(price.final).toBe(1800);
    expect(price.priceOffer).toBe(tenPercent);
    expect(price.extraOffer).toBe(twoFree);
    expect(price.extraSessions).toBe(2);
    expect(price.winningOffer).toBe(tenPercent);
  });

  it('prices an unsaved draft from its own fields, no offer naming it', () => {
    const draft = { id: null, price: 2000, offerPrice: 1800, minPrice: 0 };
    expect(effectivePrice(draft, null, [offerRecord()])).toMatchObject({
      list: 2000,
      base: 1800,
      final: 1800,
      percentOff: 10,
      winningOffer: null,
    });
  });
});

describe('the pricing helpers', () => {
  it('bills the offer price only below the list price', () => {
    expect(basePrice({ price: 1500, offerPrice: 1200 })).toBe(1200);
    expect(basePrice({ price: 1500, offerPrice: null })).toBe(1500);
    expect(basePrice({ price: 1500, offerPrice: 1500 })).toBe(1500);
    expect(basePrice({ price: 1500, offerPrice: 1600 })).toBe(1500);
    expect(basePrice({ price: 1500, offerPrice: 0 })).toBe(1500);
  });

  it('raises to the floor — 0 and a hidden floor meaning none', () => {
    expect(clampToFloor(960, 1150)).toBe(1150);
    expect(clampToFloor(1200, 1150)).toBe(1200);
    expect(clampToFloor(0, 0)).toBe(0);
    expect(clampToFloor(10, null)).toBe(10);
  });

  it('weighs a branch-limited offer only against one picked branch', () => {
    const vesuOnly = { branchIds: [VESU] };
    expect(offerAppliesAt(vesuOnly, null)).toBe(true);
    expect(offerAppliesAt(vesuOnly, VESU)).toBe(true);
    expect(offerAppliesAt(vesuOnly, ADAJAN)).toBe(false);
    expect(offerAppliesAt({ branchIds: [] }, VARACHHA)).toBe(true);
  });

  it('prices for the header branch only when exactly one is picked (H:5453)', () => {
    expect(pricingBranch([])).toBeNull();
    expect(pricingBranch([VESU])).toBe(VESU);
    expect(pricingBranch([VESU, ADAJAN])).toBeNull();
  });
});

describe('offerPreview (the Offer drawer boxes, H:5516)', () => {
  it('shows the base before and after one offer, never below a lowest price it can see', () => {
    const peel = offeringRecord(); // bills ₹1,800, floor ₹1,500
    expect(offerPreview(peel, { kind: 'percent', value: 10 })).toEqual({
      unit: 'price',
      before: 1800,
      after: 1620,
    });
    expect(offerPreview(peel, { kind: 'percent', value: 30 })).toEqual({
      unit: 'price',
      before: 1800,
      after: 1500,
    });
    expect(
      offerPreview({ ...peel, minPrice: null }, { kind: 'fixed', value: 999 }),
    ).toEqual({ unit: 'price', before: 1800, after: 999 });
    expect(offerPreview(peel, { kind: 'amount', value: 100.5 })).toEqual({
      unit: 'price',
      before: 1800,
      after: 1699.5,
    });
  });

  it('shows sessions before and after an extra-sessions offer', () => {
    expect(
      offerPreview(offeringRecord({ sessions: 6 }), { kind: 'extra', value: 1 }),
    ).toEqual({ unit: 'sessions', before: 6, after: 7 });
    expect(
      offerPreview(offeringRecord({ sessions: 0 }), { kind: 'extra', value: 2 }),
    ).toEqual({ unit: 'sessions', before: 1, after: 3 });
  });
});
