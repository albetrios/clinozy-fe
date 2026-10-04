import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { offerPreview } from '@/shared/api/clinic/offerings-pricing.ts';
import { OFFER_KIND_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  type DrawerPeekItem,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { OFFERINGS_KEYS } from '../../../offerings.constants.ts';
import { CATALOGUE_CELLS_KEYS } from '../../../shared/components/CatalogueCells/index.ts';
import { useOfferLabels } from '../../../shared/hooks/useOfferLabels/index.ts';
import { OFFERS_KEYS } from '../../offers.constants.ts';
import { OFFER_DRAWER_KEYS, OFFER_DRAWER_NS } from './offer-drawer.constants.ts';
import {
  missingOfferFields,
  OFFER_FORM_LIMITS,
  type OfferFormValues,
  offerValueOf,
} from './offer-form.ts';

const K = OFFER_DRAWER_KEYS;
const F = K.fields;

/** The drawer's three step cards (`offerings.md:246–253`). */
export type OfferStepId = 'offer' | 'where' | 'notes';

/** A step card's head: what it peeks while closed, its sub line, and its gaps. */
export interface OfferStepView {
  id: OfferStepId;
  peek: DrawerPeekItem[];
  summary: string;
  missing: string[];
}

/** One picked offering's preview box: "₹1,200 → ₹1,080" or "2 → 3 sessions". */
export interface OfferPreviewBox {
  offering: OfferingRecord;
  text: string;
}

/** What the drawer shows of its form beyond the fields: header, footer, previews and step heads. */
export interface OfferDrawerView {
  /** The value as the offer reads it: "20% off" · "₹500 off" · "at ₹3,999" · "+1 session". */
  valueLabel: string;
  /** The offer's name in its colour · the value (H:5527). */
  badges: DrawerBadge[];
  /** "Navratri glow · 20% off · 3 offerings" ("New offer · 10% off"). */
  summary: string;
  /** One box per picked offering, in pick order, at most six (`offerings.md:105`). */
  previews: OfferPreviewBox[];
  steps: OfferStepView[];
}

/** Everything the view reads beside the form. */
export interface OfferDrawerViewInput {
  values: OfferFormValues;
  /** The catalogue — the picked offerings' names, prices and sessions. */
  offerings: readonly OfferingRecord[];
  /** The open branches; Branches shows with two or more. */
  branches: readonly Branch[];
}

/** The words the view puts together, from the room's and the clinic's copy. */
function useViewWords() {
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const { t: tClinic } = useTranslation(RECORD_DRAWER_NS);
  const labels = useOfferLabels();
  const formatPaise = usePaiseFormat();
  return { t, tClinic, labels, formatPaise };
}

type ViewWords = ReturnType<typeof useViewWords>;

/** The value as its field shows it: "20%", "₹500", "1 session". */
function valueText(values: OfferFormValues, words: ViewWords): string | undefined {
  const value = offerValueOf(values);
  if (value <= 0) return undefined;
  if (values.kind === 'percent') return `${value}%`;
  if (values.kind === 'extra') {
    return words.t(OFFERINGS_KEYS.cells.sessions, { count: value });
  }
  return words.formatPaise(value);
}

/** Step 1, "Offer": Name · Code · Type · the value · Colour. */
function offerStepOf(values: OfferFormValues, words: ViewWords): OfferStepView {
  const { t, tClinic, labels } = words;
  const kind = labels.kind(values.kind);
  const value = valueText(values, words);
  return {
    id: 'offer',
    peek: [
      { kind: 'value', label: t(F.name), value: values.name.trim() },
      { kind: 'value', label: t(F.code), value: values.code },
      {
        kind: 'value',
        label: t(F.type),
        value: kind,
        tone: OFFER_KIND_TONES[values.kind],
      },
      { kind: 'value', label: t(F.value[values.kind]), value },
      {
        kind: 'value',
        label: t(F.colour),
        value: tClinic(RECORD_DRAWER_KEYS.colours[values.tone]),
        tone: values.tone,
      },
    ],
    // The head names values, never the colour (H:3840).
    summary: drawerStepSummary(
      [values.name.trim(), values.code, kind, value],
      tClinic(RECORD_DRAWER_KEYS.step.notFilled),
    ),
    missing: missingOfferFields(values).includes('name') ? [t(F.name)] : [],
  };
}

/** Step 2, "Where it applies": Offerings · Branches · Starts · Ends. */
function whereStepOf(
  values: OfferFormValues,
  input: Pick<OfferDrawerViewInput, 'offerings' | 'branches'>,
  words: ViewWords,
): OfferStepView {
  const { t, tClinic, labels } = words;
  const picked = values.offeringIds.flatMap(
    (id) => input.offerings.find((offering) => offering.id === id) ?? [],
  );
  const branches = input.branches.filter((branch) =>
    values.branchIds.includes(branch.id),
  );
  const allBranches = t(CATALOGUE_CELLS_KEYS.allBranches);
  const starts = values.startsOn
    ? labels.date(values.startsOn)
    : t(OFFERS_KEYS.cells.now);
  const ends = values.endsOn ? labels.date(values.endsOn) : t(OFFERS_KEYS.cells.noEnd);
  const branchesShown = input.branches.length > 1;
  return {
    id: 'where',
    peek: [
      {
        kind: 'multi',
        label: t(F.offerings),
        values: picked.map((offering) => ({ label: offering.name, tone: offering.tone })),
      },
      ...(branchesShown
        ? [
            {
              kind: 'multi' as const,
              label: t(F.branches),
              values:
                branches.length > 0
                  ? branches.map((branch) => ({ label: branch.name, tone: branch.tone }))
                  : [{ label: allBranches }],
            },
          ]
        : []),
      { kind: 'value', label: t(F.starts), value: starts },
      { kind: 'value', label: t(F.ends), value: ends },
    ],
    summary: drawerStepSummary(
      [
        picked.map((offering) => offering.name).join(', '),
        branchesShown
          ? branches.map((branch) => branch.name).join(', ') || allBranches
          : undefined,
        starts,
        ends,
      ],
      tClinic(RECORD_DRAWER_KEYS.step.notFilled),
    ),
    missing: missingOfferFields(values).includes('offeringIds') ? [t(F.offerings)] : [],
  };
}

/** Step 3, "Notes": Note · Status. */
function notesStepOf(values: OfferFormValues, words: ViewWords): OfferStepView {
  const { t, tClinic } = words;
  const note = values.note.trim();
  const status = t(values.live ? F.live : F.paused);
  return {
    id: 'notes',
    peek: [
      { kind: 'value', label: t(F.note), value: note },
      { kind: 'value', label: t(F.status), value: status },
    ],
    summary: drawerStepSummary(
      [note, status],
      tClinic(RECORD_DRAWER_KEYS.step.notFilled),
    ),
    missing: [],
  };
}

/** The preview boxes: the offer alone on each picked offering, never below its lowest price. */
function previewsOf(
  values: OfferFormValues,
  offerings: readonly OfferingRecord[],
  words: ViewWords,
): OfferPreviewBox[] {
  const offer = { kind: values.kind, value: offerValueOf(values) };
  return values.offeringIds
    .flatMap((id) => offerings.find((offering) => offering.id === id) ?? [])
    .slice(0, OFFER_FORM_LIMITS.previews)
    .map((offering) => {
      const preview = offerPreview(offering, offer);
      return {
        offering,
        text:
          preview.unit === 'sessions'
            ? words.t(F.previewSessions, { before: preview.before, count: preview.after })
            : words.t(F.previewPrice, {
                before: words.formatPaise(preview.before),
                after: words.formatPaise(preview.after),
              }),
      };
    });
}

/**
 * What the Offer drawer shows of its form outside the fields
 * (`offerings.md:145–157, 246–253`; H:5509–5527): the badges, the footer
 * summary, one preview per picked offering (the offer alone, as if it ran
 * everywhere) and each step's peek, head line and gaps.
 */
export function useOfferDrawerView({
  values,
  offerings,
  branches,
}: OfferDrawerViewInput): OfferDrawerView {
  const words = useViewWords();
  const { t, labels } = words;
  const name = values.name.trim() || t(K.untitled);
  const valueLabel = labels.value({ kind: values.kind, value: offerValueOf(values) });
  const count = values.offeringIds.length;
  return {
    valueLabel,
    badges: [
      { id: 'name', label: name, tone: values.tone },
      { id: 'value', label: valueLabel },
    ],
    summary: [name, valueLabel, count > 0 ? t(K.offeringCount, { count }) : '']
      .filter(Boolean)
      .join(' · '),
    previews: previewsOf(values, offerings, words),
    steps: [
      offerStepOf(values, words),
      whereStepOf(values, { offerings, branches }, words),
      notesStepOf(values, words),
    ],
  };
}

/** The toast a missing field raises when Save opens its step (H:5521). */
export function missingOfferToast(
  missing: readonly ('name' | 'offeringIds')[],
  t: TFunction,
): string | null {
  if (missing.includes('name')) return t(K.toasts.name);
  if (missing.includes('offeringIds')) return t(K.toasts.offerings);
  return null;
}
