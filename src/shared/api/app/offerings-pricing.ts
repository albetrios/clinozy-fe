import { paiseOfRupees, rupeesOfPaise } from '@/lib/number-text.ts';

import type { OfferingRecord, OfferRecord } from './offerings-contracts.ts';

/*
 * What the Offerings room works out for itself from the offers it read (routes-final §3.10:
 * "Billed today … is worked out by the screen from the offers") — pure functions on the API's
 * units: money in rupees with two places, an offer counting while the server says it is
 * `live`. The offer's status is the server's (O10); none of this decides it.
 */

/** The offering fields pricing reads; `id` is `null` for an offering not saved yet (no offer names it). */
export type PricedOffering = Pick<OfferingRecord, 'price' | 'offerPrice' | 'minPrice'> & {
  id: string | null;
};

/** The offer fields pricing reads. */
export type PricedOffer = Pick<
  OfferRecord,
  'kind' | 'value' | 'offeringIds' | 'branchIds' | 'status'
>;

/** What offers apply to: the offer price when one is set below the list price, else the list price (H:3589). */
export function basePrice(
  offering: Pick<OfferingRecord, 'price' | 'offerPrice'>,
): number {
  const { price, offerPrice } = offering;
  return offerPrice !== null && offerPrice > 0 && offerPrice < price ? offerPrice : price;
}

/**
 * A price raised to the lowest price (the floor). A floor of 0 is none, and so is one the
 * member cannot see (`null`, O15) — the server holds the bill to it either way.
 */
export function clampToFloor(amount: number, minPrice: number | null): number {
  return minPrice !== null && minPrice > 0 && amount < minPrice ? minPrice : amount;
}

/**
 * Whether an offer can be used where prices are worked out: every offer when no single branch
 * is picked (`branchId` null), else an every-branch offer (no branches) or one that names this
 * branch (H:3589).
 */
export function offerAppliesAt(
  offer: Pick<OfferRecord, 'branchIds'>,
  branchId: string | null,
): boolean {
  return (
    branchId === null ||
    offer.branchIds.length === 0 ||
    offer.branchIds.includes(branchId)
  );
}

/**
 * The branch prices are worked out for: the header's branch when exactly one is picked, else
 * `null` (H:5453) — so a branch-limited offer is weighed against its branches only once the
 * header narrows to one.
 */
export function pricingBranch(branchFilter: readonly string[]): string | null {
  return branchFilter.length === 1 ? (branchFilter[0] ?? null) : null;
}

/**
 * A price offer applied to a base, in rupees. A percentage rounds to the whole rupee, as the
 * design does: ₹1,350 at 15% off is ₹1,148. An amount comes off to the paisa and never below
 * 0; a fixed price never raises the base.
 */
function priceAfter(base: number, offer: Pick<OfferRecord, 'kind' | 'value'>): number {
  switch (offer.kind) {
    case 'percent':
      return Math.round(base * (1 - offer.value / 100));
    case 'amount':
      return rupeesOfPaise(Math.max(0, paiseOfRupees(base) - paiseOfRupees(offer.value)));
    case 'fixed':
      return offer.value > 0 ? Math.min(base, offer.value) : base;
    case 'extra':
      return base;
  }
}

/** What {@link effectivePrice} works out for one offering. Money in rupees. */
export interface EffectivePrice<O> {
  /** The list price — "was ₹1,500", "list price · shown on the invoice". */
  list: number;
  /** The price offers apply to — {@link basePrice}. */
  base: number;
  /** What is billed today: the best offer applied to the base, never below the lowest price. */
  final: number;
  /** Percent below the list price, rounded — "20% off", "17% below list". */
  percentOff: number;
  /** The price offer that won (lowest result), or `null`. */
  priceOffer: O | null;
  /** The extra-sessions offer that won (most sessions), or `null`. */
  extraOffer: O | null;
  /** Free sessions from {@link extraOffer}; 0 when none — "6 sessions + 1 free". */
  extraSessions: number;
  /** The offer the row shows as its Offer pill: the price offer, else the extra-sessions one. */
  winningOffer: O | null;
}

/**
 * The price billed today ("Billed today", `ofEff`, H:3589, Q-O2). Only the offers the server
 * calls `live` that name this offering count, and a branch-limited one only per
 * {@link offerAppliesAt}. Price offers don't stack — the lowest result wins (% → base × (1 −
 * v/100), rounded to the rupee; ₹ off → base − v, at least 0; fixed → the lower of base and v).
 * Extra-sessions offers don't stack either — the most sessions win — but combine with a price
 * offer. The result is then raised to the lowest price, when the member can see it. On a tie
 * the earlier offer in `offers` stays.
 *
 * @param offering The offering (or a drawer's draft — `id` null).
 * @param branchId The branch prices are for ({@link pricingBranch}); `null` = no single branch.
 * @param offers The offers to weigh — any order, any status.
 */
export function effectivePrice<O extends PricedOffer>(
  offering: PricedOffering,
  branchId: string | null,
  offers: readonly O[],
): EffectivePrice<O> {
  const list = offering.price;
  const base = basePrice(offering);
  let final = base;
  let priceOffer: O | null = null;
  let extraOffer: O | null = null;
  let extraSessions = 0;

  for (const offer of offers) {
    const counts =
      offering.id !== null &&
      offer.offeringIds.includes(offering.id) &&
      offer.status === 'live' &&
      offerAppliesAt(offer, branchId);
    if (!counts) continue;
    if (offer.kind === 'extra') {
      if (offer.value > extraSessions) {
        extraSessions = offer.value;
        extraOffer = offer;
      }
      continue;
    }
    const after = priceAfter(base, offer);
    if (after < final) {
      final = after;
      priceOffer = offer;
    }
  }

  final = clampToFloor(final, offering.minPrice);
  return {
    list,
    base,
    final,
    percentOff: list ? Math.round((1 - final / list) * 100) : 0,
    priceOffer,
    extraOffer,
    extraSessions,
    winningOffer: priceOffer ?? extraOffer,
  };
}

/** One Offer-drawer preview box: the price before → after, or the sessions before → after. */
export interface OfferPreview {
  unit: 'price' | 'sessions';
  before: number;
  after: number;
}

/**
 * What one offer would do to one offering — the Offer drawer's preview boxes, a preview of
 * what is being typed (`offerings.md:105`, H:5516): "₹1,200 → ₹1,080" from the base, as if the
 * offer ran alone and everywhere, never below the lowest price; or "2 → 3 sessions" for extra
 * sessions.
 */
export function offerPreview(
  offering: Pick<OfferingRecord, 'price' | 'offerPrice' | 'minPrice' | 'sessions'>,
  offer: Pick<OfferRecord, 'kind' | 'value'>,
): OfferPreview {
  if (offer.kind === 'extra') {
    const before = offering.sessions || 1;
    return { unit: 'sessions', before, after: before + offer.value };
  }
  const before = basePrice(offering);
  return {
    unit: 'price',
    before,
    after: clampToFloor(Math.min(before, priceAfter(before, offer)), offering.minPrice),
  };
}
