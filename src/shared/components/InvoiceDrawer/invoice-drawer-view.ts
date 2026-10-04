import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import {
  type DrawerPeekItem,
  type DrawerPeekPill,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import { PATIENT_PICKER_KEYS } from '@/shared/components/PatientPicker/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_TYPE_TONES,
} from './invoice-drawer.constants.ts';
import {
  type InvoiceDraftFigures,
  type InvoiceFormValues,
  namedLines,
  paidNowSplits,
  percentOf,
} from './invoice-form.ts';
import { coveredSessions } from './invoice-lines.ts';

const K = INVOICE_DRAWER_KEYS;

/** The drawer's three steps, in order (`payments.md:328`). */
export type InvoiceStepId = 'party' | 'items' | 'payment';

/** What the drawer shows of the form beyond its fields: header, badges, footer and step heads. */
export interface InvoiceDrawerView {
  title: string;
  tag?: string;
  sub: string;
  badges: DrawerBadge[];
  /** "Medical · Rhea Shah · 1 item". */
  summary: string;
  saveLabel: string;
  steps: Record<
    InvoiceStepId,
    { title: string; summary: string; peek: DrawerPeekItem[]; missing: string[] }
  >;
}

/** What the view reads besides the form. */
export interface InvoiceDrawerViewInput {
  values: InvoiceFormValues;
  figures: InvoiceDraftFigures;
  /** The saved invoice's number on an edit. */
  seq: number | null;
  /** Opened as Medical's New sale: the type locked to Medical. */
  sale: boolean;
  offerings: ReadonlyMap<string, OfferingRecord>;
  /** Team members by id as their peek pills — short name, own tone ("Dr. Drashti"). */
  staff: ReadonlyMap<string, DrawerPeekPill>;
  /** The picked branch — the first step's sub line and its toned peek tile. */
  branch: { name: string; tone?: Tone } | null;
}

/** Type · "Bill ₹324" · "Covers 6 sessions" · "Cash + UPI" · Draft / "₹324 due" / "Fully paid" (H:5068). */
function badgesOf(
  input: InvoiceDrawerViewInput,
  t: TFunction,
  formatPaise: (paise: number) => string,
): DrawerBadge[] {
  const { values, figures } = input;
  const lines = namedLines(values.items);
  const badges: DrawerBadge[] = [
    {
      id: 'type',
      label: t(CLINIC_KEYS.invoiceTypes[values.type]),
      tone: INVOICE_TYPE_TONES[values.type],
    },
    { id: 'bill', label: t(K.badges.bill, { amount: formatPaise(figures.totals.bill) }) },
  ];
  const sessions =
    values.type === 'medical' ? 0 : coveredSessions(lines, input.offerings);
  if (sessions > 0) {
    badges.push({
      id: 'sessions',
      label: t(K.badges.sessions, { count: sessions }),
      tone: 'lav',
    });
  }
  const modes = paidNowSplits(values.paidNow).map((split) =>
    t(CLINIC_KEYS.paymentModes[split.mode]),
  );
  if (modes.length > 1)
    badges.push({ id: 'modes', label: modes.join(' + '), tone: 'sky' });
  if (lines.length === 0) badges.push({ id: 'status', label: t(K.badges.draft) });
  else if (figures.balance.due > 0) {
    badges.push({
      id: 'status',
      label: t(K.badges.due, { amount: formatPaise(figures.balance.due) }),
      tone: 'blush',
    });
  } else badges.push({ id: 'status', label: t(K.badges.paid), tone: 'sage' });
  return badges;
}

/** The step heads, their sub lines, their collapsed peeks and what each still misses. */
function stepsOf(
  input: InvoiceDrawerViewInput,
  t: TFunction,
  formatPaise: (paise: number) => string,
): InvoiceDrawerView['steps'] {
  const { values } = input;
  const medical = values.type === 'medical';
  const lines = namedLines(values.items);
  const notFilled = t(RECORD_DRAWER_KEYS.step.notFilled, { ns: RECORD_DRAWER_NS });
  const partyLabel = t(medical ? K.fields.customer : PATIENT_PICKER_KEYS.label);
  const teamLabel = t(medical ? K.fields.prescribedBy : K.fields.team);
  // A member the staff list has not loaded (or no longer lists) is left out, never a blank pill.
  const team = values.teamIds.flatMap((id) => {
    const pill = input.staff.get(id);
    return pill ? [pill] : [];
  });
  const percent = `${percentOf(values.overallDiscountPct)}%`;
  const modes = values.paidNow.map((row) => t(CLINIC_KEYS.paymentModes[row.mode]));
  const paid = paidNowSplits(values.paidNow).map(
    (split) => `${t(CLINIC_KEYS.paymentModes[split.mode])} ${formatPaise(split.amount)}`,
  );
  const remark = values.remark.trim() || undefined;
  return {
    party: {
      title: t(K.steps.party),
      // H:3840: the step's values while it is open — "Adajan · Riya S.".
      summary: drawerStepSummary(
        [
          input.branch?.name,
          values.party?.name,
          team.map((pill) => pill.label).join(', '),
        ],
        notFilled,
      ),
      missing: values.party ? [] : [partyLabel],
      peek: [
        {
          kind: 'value',
          label: t(K.fields.branch),
          value: input.branch?.name,
          tone: input.branch?.tone,
        },
        { kind: 'value', label: partyLabel, value: values.party?.name, tone: 'sky' },
        { kind: 'multi', label: teamLabel, values: team },
      ],
    },
    items: {
      title: t(medical ? K.steps.medicines : K.steps.items),
      summary: drawerStepSummary(
        [lines.length > 0 ? t(K.summaryItems, { count: lines.length }) : undefined],
        notFilled,
      ),
      // The rows are checked on save ("Add at least one item"), never in the head (H:3840).
      missing: [],
      peek: [
        {
          kind: 'items',
          label: t(medical ? K.items.columns.medicine : K.items.columns.offering),
          names: lines.map((line) => line.name),
        },
      ],
    },
    payment: {
      title: t(K.steps.payment),
      summary: drawerStepSummary([percent, ...paid, remark], notFilled),
      missing: [],
      // The prototype's peek lists every field of the step (H:3832–3834).
      peek: [
        { kind: 'value', label: t(K.fields.overallDiscount), value: percent },
        { kind: 'value', label: t(K.fields.quickFill) },
        { kind: 'items', label: t(K.payment.mode), names: modes },
        { kind: 'value', label: t(K.fields.remark), value: remark },
      ],
    },
  };
}

/** The header's words for the drawer's mode: new or edit, invoice or sale (`payments.md:134`). */
function headerOf(input: InvoiceDrawerViewInput, t: TFunction) {
  const editing = input.seq !== null;
  if (input.sale) {
    return {
      title: t(editing ? K.title.editSale : K.title.createSale),
      sub: t(K.sub.sale),
    };
  }
  return {
    title: t(editing ? K.title.edit : K.title.create),
    sub: t(editing ? K.sub.edit : K.sub.create),
  };
}

/** The Invoice drawer's derived words and pills (KICKOFF §6.9). */
export function useInvoiceDrawerView(input: InvoiceDrawerViewInput): InvoiceDrawerView {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const { values } = input;
  const lines = namedLines(values.items);
  const typeLabel = t(CLINIC_KEYS.invoiceTypes[values.type]);
  return {
    ...headerOf(input, t),
    tag: input.seq === null ? undefined : displayId.invoiceNumber(input.seq),
    badges: badgesOf(input, t, formatPaise),
    summary: t(K.summary, {
      type: typeLabel,
      name: values.party?.name ?? t(K.noPatient),
      items: t(K.summaryItems, { count: lines.length }),
    }),
    saveLabel: input.seq === null ? t(K.save[values.type]) : t(K.save.edit),
    steps: stepsOf(input, t, formatPaise),
  };
}
