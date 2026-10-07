import { clinicToday } from './clinic-time.ts';
import type { OfferingRecord, OfferRecord, OfferState } from './offerings-contracts.ts';

/*
 * Offerings pricing — pure functions shared by the Offerings room, the Invoice
 * drawer and the booking drawer (KICKOFF §6.11 Data, §5: derived values are
 * computed, never stored). Ports of the prototype's `ofxState` (H:3588) and
 * `ofEff` (H:3589) on the contract's units: money in paise, calendar dates as
 * clinic-local `YYYY-MM-DD` (S:7) on the real clinic clock, never a demo one
 * (D15).
 */

const PAISE_PER_RUPEE = 100;

/** The offering fields pricing reads; `id` is `null` for an offering not saved yet (no offer names it). */
export type PricedOffering = Pick<OfferingRecord, 'price' | 'offerPrice' | 'minPrice'> & {
  id: string | null;
};

/** The offer fields pricing reads; a soft-deleted offer (`deletedAt` set) never counts. */
export type PricedOffer = Pick<
  OfferRecord,
  'kind' | 'value' | 'offeringIds' | 'branchIds' | 'startsOn' | 'endsOn' | 'paused'
> & { deletedAt?: string | null };

/**
 * An offer's state on a clinic-local day (`ofxState`, H:3588): paused →
 * `paused`; before its start → `scheduled`; after its end → `ended`; else
 * `live` ("Running"). An open start ("Now") is never scheduled and an open end
 * ("no end") never ends. Both days are inclusive.
 */
export function offerState(
  offer: Pick<OfferRecord, 'paused' | 'startsOn' | 'endsOn'>,
  today: string,
): OfferState {
  if (offer.paused) return 'paused';
  if (offer.startsOn !== null && today < offer.startsOn) return 'scheduled';
  if (offer.endsOn !== null && today > offer.endsOn) return 'ended';
  return 'live';
}

/** What offers apply to: the offer price when one is set below the list price, else the list price (H:3589). */
export function basePrice(
  offering: Pick<OfferingRecord, 'price' | 'offerPrice'>,
): number {
  const { price, offerPrice } = offering;
  return offerPrice !== null && offerPrice > 0 && offerPrice < price ? offerPrice : price;
}

/** A price raised to the lowest price (the floor); a floor of 0 means none. */
export function clampToFloor(amount: number, minPrice: number): number {
  return minPrice > 0 && amount < minPrice ? minPrice : amount;
}

/**
 * Whether an offer can be used where prices are worked out: every offer when
 * no single branch is picked (`branchId` null), else an every-branch offer
 * (no branches) or one that names this branch (H:3589).
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
 * The branch prices are worked out for: the header's branch when exactly one
 * is picked, else `null` (H:5453) — so a branch-limited offer is weighed
 * against its branches only once the header narrows to one.
 */
export function pricingBranch(branchFilter: readonly string[]): string | null {
  return branchFilter.length === 1 ? (branchFilter[0] ?? null) : null;
}

/**
 * A price offer applied to a base, in paise. A percentage rounds to the whole
 * rupee, as the prototype (which prices in rupees) does: ₹1,350 at 15% off is
 * ₹1,148. An amount never goes below 0; a fixed price never raises the base.
 */
function priceAfter(base: number, offer: Pick<OfferRecord, 'kind' | 'value'>): number {
  switch (offer.kind) {
    case 'percent':
      return (
        Math.round((base / PAISE_PER_RUPEE) * (1 - offer.value / 100)) * PAISE_PER_RUPEE
      );
    case 'amount':
      return Math.max(0, base - offer.value);
    case 'fixed':
      return offer.value > 0 ? Math.min(base, offer.value) : base;
    case 'extra':
      return base;
  }
}

/** What {@link effectivePrice} works out for one offering. Money in paise. */
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
 * The price billed today (`ofEff`, H:3589, Q-O2). Only `live` offers that name
 * this offering count, and a branch-limited one only per
 * {@link offerAppliesAt}. Price offers don't stack — the lowest result wins (%
 * → base × (1 − v/100), rounded to the rupee; ₹ off → base − v, at least 0;
 * fixed → the lower of base and v). Extra-sessions offers don't stack either —
 * the most sessions win — but combine with a price offer. The result is then
 * raised to the lowest price. On a tie the earlier offer in `offers` stays.
 *
 * @param offering The offering (or a drawer's draft — `id` null).
 * @param branchId The branch prices are for ({@link pricingBranch}); `null` = no single branch.
 * @param offers The offers to weigh — any order, any state.
 * @param today The clinic-local day (`YYYY-MM-DD`); today on the clinic clock by default.
 */
export function effectivePrice<O extends PricedOffer>(
  offering: PricedOffering,
  branchId: string | null,
  offers: readonly O[],
  today: string = clinicToday(),
): EffectivePrice<O> {
  const list = offering.price;
  const base = basePrice(offering);
  let final = base;
  let priceOffer: O | null = null;
  let extraOffer: O | null = null;
  let extraSessions = 0;

  for (const offer of offers) {
    const counts =
      !offer.deletedAt &&
      offering.id !== null &&
      offer.offeringIds.includes(offering.id) &&
      offerState(offer, today) === 'live' &&
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

/**
 * An offering's price as an invoice line's rate (Q-O3): an exclusive price is
 * the rate, GST charged on top; an inclusive one has its GST back-computed out
 * of it, to the paisa, so the line still comes to the price.
 */
export function invoiceLineRate(
  price: number,
  gstPct: number,
  gstInclusive: boolean,
): number {
  if (gstInclusive && gstPct > 0) return Math.round(price / (1 + gstPct / 100));
  return price;
}

/** One Offer-drawer preview box: the price before → after, or the sessions before → after. */
export interface OfferPreview {
  unit: 'price' | 'sessions';
  before: number;
  after: number;
}

/**
 * What one offer would do to one offering — the Offer drawer's preview boxes
 * (`offerings.md:105`, H:5516): "₹1,200 → ₹1,080" from the base, as if the offer
 * ran alone and everywhere, never below the lowest price; or "2 → 3 sessions"
 * for extra sessions.
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
