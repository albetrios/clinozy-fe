import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import {
  type EffectivePrice,
  effectivePrice,
} from '@/shared/api/app/offerings-pricing.ts';
import { OFFERING_CATEGORY_TONES } from '@/shared/app/app-tones.ts';
import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { OFFERINGS_KEYS } from '../../offerings.constants.ts';
import { CATALOGUE_CELLS_KEYS } from '../../shared/components/CatalogueCells/index.ts';
import { useOfferLabels } from '../../shared/hooks/useOfferLabels/index.ts';
import { useOfferingText } from '../OfferingCells/index.ts';
import { OFFERING_DRAWER_KEYS, OFFERING_DRAWER_NS } from './offering-drawer.constants.ts';
import {
  missingOfferingFields,
  type OfferingFormValues,
  offeringPricesOf,
  rupeesOfText,
  VALIDITY_QUICK_PICKS,
} from './offering-form.ts';

const K = OFFERING_DRAWER_KEYS;
const F = K.fields;

/** One offer that has not ended on this offering — a read-only "Offers on this" box. */
export interface OfferOnThis {
  offer: OfferRecord;
  /** "+1 session · Running · till 31 Oct 2026". */
  text: string;
}

/**
 * The drawer's step cards (`offerings.md:237–244`): "Offering, price &
 * sessions" (`offering`) then "Time, validity & details" (`time`) — or, while an
 * offer that has not ended names the offering, "Offers on this, time &
 * validity" (`time`) and "Details" (`details`).
 */
export type OfferingStepId = 'offering' | 'time' | 'details';

/** A step card's head: what it peeks while closed, and its gaps. */
interface OfferingStepView {
  id: OfferingStepId;
  peek: DrawerPeekItem[];
  missing: string[];
}

/** What the drawer shows of its form beyond the fields: header, footer and step heads. */
export interface OfferingDrawerView {
  /** The pricing of the draft for the header's branch — "Billed today", the badge, the summary. */
  priced: EffectivePrice<OfferRecord>;
  /** "₹7,500 · Navratri glow · +1 free session · 17% below list" once a price is set. */
  billedToday: string | null;
  /** The Offer price's hint: "what you bill · 17% below list" once it is under the price. */
  offerPriceHint: string;
  /** Offers on this offering that have not ended — three steps while there is one. */
  offersOnThis: OfferOnThis[];
  /** The category · the billed price · "6 sessions" (H:5528). */
  badges: DrawerBadge[];
  /** The footer's "Underarm Peel · Package · ₹7,500 · 6 sessions" ("Untitled · Treatment"). */
  summary: string;
  /** The step cards' heads, in order: two, or three while an offer runs on it. */
  steps: OfferingStepView[];
}

/** Everything the view reads beside the form. */
export interface OfferingDrawerViewInput {
  values: OfferingFormValues;
  /** The saved offering an edit opens; `null` for a new one (no offer names it yet). */
  offering: OfferingRecord | null;
  offers: readonly OfferRecord[];
  /** The open branches; "Available at" shows with two or more. */
  branches: readonly BranchOption[];
  /** The header's pricing branch (`pricingBranch`). */
  pricingBranchId: string | null;
}

/**
 * The offers on this offering that the server does not call ended, in its order — Running
 * first, then scheduled, then paused (H:5499).
 */
function offersNotEnded(
  offering: OfferingRecord | null,
  offers: readonly OfferRecord[],
): OfferRecord[] {
  if (!offering) return [];
  return offers.filter(
    (offer) => offer.offeringIds.includes(offering.id) && offer.status !== 'ended',
  );
}

/** The words the view puts together, from the room's and the clinic's copy. */
function useViewWords() {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const { t: tApp } = useTranslation(RECORD_DRAWER_NS);
  const text = useOfferingText();
  const labels = useOfferLabels();
  const formatRupees = useRupeeFormat();
  return { t, tApp, text, labels, formatRupees };
}

type ViewWords = ReturnType<typeof useViewWords>;

/** "₹7,500 · Navratri glow · +1 free session · 17% below list" (H:5498). */
function billedTodayText(priced: EffectivePrice<OfferRecord>, words: ViewWords): string {
  const { t, formatRupees } = words;
  return [
    formatRupees(priced.final),
    priced.priceOffer?.name,
    priced.extraSessions > 0 ? t(F.freeSessions, { count: priced.extraSessions }) : '',
    priced.final < priced.list ? t(F.belowList, { percent: priced.percentOff }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The Validity value as its quick pick names it ("None", "6 mo"), else "120 days". */
function validityText(days: number, words: ViewWords): string {
  const pick = VALIDITY_QUICK_PICKS.find((quick) => quick.days === days);
  return pick ? words.t(F.validityQuick[pick.id]) : words.t(F.days, { count: days });
}

/** Step 1's heads: Name · Category · Colour · Available at · the prices and sessions. */
function mainStepOf(
  values: OfferingFormValues,
  branches: readonly BranchOption[],
  words: ViewWords,
): OfferingStepView {
  const { t, tApp, text, formatRupees } = words;
  const price = rupeesOfText(values.price);
  const offerPrice = rupeesOfText(values.offerPrice);
  const category = text.category(values.category);
  const picked = branches.filter((branch) => values.branchIds.includes(branch.id));
  const branchesShown = branches.length > 1;
  const allBranches = t(CATALOGUE_CELLS_KEYS.allBranches);
  const gst = t(values.isGstInclusive ? F.gstInclusive : F.gstExclusive);
  const money = (rupees: number) => (rupees > 0 ? formatRupees(rupees) : undefined);
  // None picked yet: the server applies the category's rate — the step names none.
  const gstRate =
    values.gstPercent === '' ? undefined : t(F.gstChip, { value: values.gstPercent });

  const peek: DrawerPeekItem[] = [
    { kind: 'value', label: t(F.name), value: values.name.trim() },
    {
      kind: 'value',
      label: t(F.category),
      value: category,
      tone: OFFERING_CATEGORY_TONES[values.category],
    },
    {
      kind: 'value',
      label: t(F.colour),
      value: tApp(RECORD_DRAWER_KEYS.colours[values.tone]),
      tone: values.tone,
    },
    ...(branchesShown
      ? [
          {
            kind: 'multi' as const,
            label: t(F.availableAt),
            values:
              picked.length > 0
                ? picked.map((branch) => ({ label: branch.name, tone: branch.tone }))
                : [{ label: allBranches }],
          },
        ]
      : []),
    { kind: 'value', label: t(F.price), value: money(price) },
    { kind: 'value', label: t(F.offerPrice), value: money(offerPrice) },
    { kind: 'value', label: t(F.sessions), value: String(values.sessions) },
    { kind: 'value', label: t(F.gstRate), value: gstRate },
    { kind: 'value', label: t(F.gst), value: gst },
  ];

  return {
    id: 'offering',
    peek,
    missing: missingOfferingFields(values).map((field) =>
      field === 'name' ? t(F.name) : t(F.price),
    ),
  };
}

/** TIME & VALIDITY: Duration · Validity (read-only boxes never peek, H:3834). */
function timePeekOf(values: OfferingFormValues, words: ViewWords): DrawerPeekItem[] {
  const { t } = words;
  return [
    {
      kind: 'value',
      label: t(F.duration),
      value: t(OFFERINGS_KEYS.cells.minutes, { minutes: values.durationMinutes }),
    },
    {
      kind: 'value',
      label: t(F.validity),
      value: validityText(values.validityDays, words),
    },
  ];
}

/** DETAILS: Search terms · Description · Status. */
function detailsPeekOf(values: OfferingFormValues, words: ViewWords): DrawerPeekItem[] {
  const { t } = words;
  return [
    { kind: 'value', label: t(F.searchTerms), value: values.searchTerms.trim() },
    { kind: 'value', label: t(F.description), value: values.description.trim() },
    {
      kind: 'value',
      label: t(F.status),
      value: t(values.isActive ? F.active : F.inactive),
    },
  ];
}

/** The steps after the first: one for time and details, or two around the offers on this. */
function laterStepsOf(
  values: OfferingFormValues,
  offersOnThis: readonly OfferOnThis[],
  words: ViewWords,
): OfferingStepView[] {
  const time = timePeekOf(values, words);
  const details = detailsPeekOf(values, words);
  // No required field among them.
  if (offersOnThis.length === 0) {
    return [{ id: 'time', peek: [...time, ...details], missing: [] }];
  }
  // The offers' boxes are read-only: they never peek.
  return [
    { id: 'time', peek: time, missing: [] },
    { id: 'details', peek: details, missing: [] },
  ];
}

/**
 * What the Offering drawer shows of its form outside the fields
 * (`offerings.md:131–143, 237–244`; H:5485–5528): the draft priced for the
 * header's branch — "Billed today", the badge strip and the footer summary —
 * the offers that have not ended (three steps while there is one), and each
 * step's peek and gaps.
 */
export function useOfferingDrawerView({
  values,
  offering,
  offers,
  branches,
  pricingBranchId,
}: OfferingDrawerViewInput): OfferingDrawerView {
  const words = useViewWords();
  const { t, text, labels, formatRupees } = words;

  const prices = offeringPricesOf(values);
  const priced = effectivePrice(
    { id: offering?.id ?? null, ...prices },
    pricingBranchId,
    offers,
  );
  const billedToday = prices.price > 0 ? billedTodayText(priced, words) : null;
  const offer = rupeesOfText(values.offerPrice);
  const offersOnThis = offersNotEnded(offering, offers).map((entry) => ({
    offer: entry,
    text: [
      labels.value(entry),
      labels.state(entry.status),
      entry.endsOn ? t(K.offerTill, { date: labels.date(entry.endsOn) }) : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }));

  const category = text.category(values.category);
  const sessions = values.sessions > 1 ? text.sessions(values.sessions, 0) : '';
  const billed = prices.price > 0 ? formatRupees(priced.final) : '';

  return {
    priced,
    billedToday,
    offerPriceHint:
      prices.price > 0 && offer > 0 && offer < prices.price
        ? t(F.offerPriceBelow, {
            percent: Math.round((1 - offer / prices.price) * 100),
          })
        : t(F.offerPriceHint),
    offersOnThis,
    badges: [
      {
        id: 'category',
        label: category,
        tone: OFFERING_CATEGORY_TONES[values.category],
      },
      ...(billed ? [{ id: 'billed', label: billed, tone: values.tone }] : []),
      ...(sessions ? [{ id: 'sessions', label: sessions }] : []),
    ],
    summary: [values.name.trim() || t(K.untitled), category, billed, sessions]
      .filter(Boolean)
      .join(' · '),
    steps: [
      mainStepOf(values, branches, words),
      ...laterStepsOf(values, offersOnThis, words),
    ],
  };
}

/** The toast a missing field raises when Save opens its step (H:5507). */
export function missingFieldToast(
  missing: readonly ('name' | 'price')[],
  t: TFunction,
): string | null {
  if (missing.includes('name')) return t(K.toasts.addName);
  if (missing.includes('price')) return t(K.toasts.addPrice);
  return null;
}
