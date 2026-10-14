import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import type {
  DrawerPeekItem,
  DrawerPeekPill,
} from '@/shared/components/DrawerSteps/index.ts';
import { PATIENT_PICKER_KEYS } from '@/shared/components/PatientPicker/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_TYPE_TONES,
} from './invoice-drawer.constants.ts';
import type { InvoiceFigures } from './invoice-figures.ts';
import {
  type InvoiceFormValues,
  namedLines,
  overallDiscountPaise,
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
    { title: string; peek: DrawerPeekItem[]; missing: string[] }
  >;
}

/** What the view reads besides the form. */
export interface InvoiceDrawerViewInput {
  values: InvoiceFormValues;
  figures: InvoiceFigures;
  /** The saved invoice's number on an edit. */
  seq: number | null;
  /** Opened as Medical's New sale: the type locked to Medical. */
  sale: boolean;
  /** The lines as the server's preview prices them — "Covers 6 sessions". */
  sessionLines: readonly { qty: number; sessionsTotal: number | null }[];
  /** Team members by id as their peek pills — short name, own tone ("Dr. Drashti"). */
  staff: ReadonlyMap<string, DrawerPeekPill>;
  /** The picked branch — the first step's toned peek tile. */
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
  const shown = figures.status !== 'refused' && figures.status !== 'failed';
  const badges: DrawerBadge[] = [
    {
      id: 'type',
      label: t(APP_KEYS.invoiceTypes[values.type]),
      tone: INVOICE_TYPE_TONES[values.type],
    },
    {
      id: 'bill',
      label: t(K.badges.bill, { amount: shown ? formatPaise(figures.bill) : '—' }),
    },
  ];
  const sessions = values.type === 'medical' ? 0 : coveredSessions(input.sessionLines);
  if (sessions > 0) {
    badges.push({
      id: 'sessions',
      label: t(K.badges.sessions, { count: sessions }),
      tone: 'lav',
    });
  }
  const modes = paidNowSplits(values.paidNow).map((split) =>
    t(APP_KEYS.paymentModes[split.mode]),
  );
  if (modes.length > 1)
    badges.push({ id: 'modes', label: modes.join(' + '), tone: 'sky' });
  if (lines.length === 0 || !shown) {
    badges.push({ id: 'status', label: t(K.badges.draft) });
  } else if (figures.due > 0) {
    badges.push({
      id: 'status',
      label: t(K.badges.due, { amount: formatPaise(figures.due) }),
      tone: 'blush',
    });
  } else badges.push({ id: 'status', label: t(K.badges.paid), tone: 'sage' });
  return badges;
}

/**
 * The Payment step's peek between its discount and its remark: "Paid now" on a new invoice
 * (Quick fill and the modes), what is paid and due on a saved one — paid through Payments.
 */
function paymentPeek(
  input: InvoiceDrawerViewInput,
  t: TFunction,
  formatPaise: (paise: number) => string,
): DrawerPeekItem[] {
  if (input.seq !== null && !input.sale) {
    const paid = t(K.payment.paidTotal, {
      paid: formatPaise(input.figures.paidBefore),
      due: formatPaise(input.figures.due),
    });
    return [{ kind: 'value', label: t(K.fields.paid), value: paid }];
  }
  const modes = input.values.paidNow.map((row) => t(APP_KEYS.paymentModes[row.mode]));
  return [
    { kind: 'value', label: t(K.fields.quickFill) },
    { kind: 'items', label: t(K.payment.mode), names: modes },
  ];
}

/** The step heads, their collapsed peeks and what each still misses. */
function stepsOf(
  input: InvoiceDrawerViewInput,
  t: TFunction,
  formatPaise: (paise: number) => string,
): InvoiceDrawerView['steps'] {
  const { values } = input;
  const medical = values.type === 'medical';
  const lines = namedLines(values.items);
  const partyLabel = t(medical ? K.fields.customer : PATIENT_PICKER_KEYS.label);
  const teamLabel = t(medical ? K.fields.prescribedBy : K.fields.team);
  // A member the staff list has not loaded (or no longer lists) is left out, never a blank pill.
  const team = values.teamIds.flatMap((id) => {
    const pill = input.staff.get(id);
    return pill ? [pill] : [];
  });
  // A sale's overall discount is a percent (Q-G7); an invoice's an amount, as the API takes it.
  const discount = medical
    ? `${percentOf(values.overallDiscountPct)}%`
    : formatPaise(overallDiscountPaise(values));
  const remark = values.remark.trim() || undefined;
  return {
    party: {
      title: t(K.steps.party),
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
      missing: [],
      // The prototype's peek lists every field of the step (H:3832–3834).
      peek: [
        { kind: 'value', label: t(K.fields.overallDiscount), value: discount },
        ...paymentPeek(input, t, formatPaise),
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
  const typeLabel = t(APP_KEYS.invoiceTypes[values.type]);
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
