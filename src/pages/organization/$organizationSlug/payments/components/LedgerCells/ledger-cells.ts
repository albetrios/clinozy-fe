import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicDateOf } from '@/shared/api/clinic/clinic-filter-match.ts';
import type { PaymentMode, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type {
  LedgerRow,
  PaymentEditSide,
} from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_KIND_TONES } from '@/shared/clinic/clinic-tones.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';

/*
 * What the ledger's cells say about an entry (`payments.md:29`, H:5096–5108) —
 * pure wording, and the two hooks that word it for the viewer, so the cells,
 * the meta line, the phone rows, Day close's review and the CSV export all
 * word an entry the same way.
 */

const SUB = PAYMENTS_KEYS.ledger.sub;

/** The What pill: "Received" or "Paid", in the kind's tone. */
export function ledgerWhat(row: Pick<LedgerRow, 'direction' | 'kind'>): {
  labelKey: string;
  tone: Tone;
} {
  return {
    labelKey: PAYMENTS_KEYS.directions[row.direction],
    tone: PAYMENT_KIND_TONES[row.kind],
  };
}

/** The modes of an entry's split rows, each once: "Cash + UPI" reads two. */
export function ledgerModes(row: Pick<LedgerRow, 'splits'>): PaymentMode[] {
  return [...new Set(row.splits.map((split) => split.mode))];
}

/** "Cash + UPI" — the modes as the Mode pill joins them (`payments.md:29`). */
export function ledgerModesLabel(
  modes: readonly PaymentMode[],
  tClinic: TFunction,
): string {
  return modes.map((mode) => tClinic(CLINIC_KEYS.paymentModes[mode])).join(' + ');
}

/** A receipt's part: its invoice — "Sale · Invoice #785" for a medical one. */
function receiptParts(row: LedgerRow, t: TFunction): string[] {
  if (!row.invoice) return [];
  return [
    t(row.invoice.type === 'medical' ? SUB.sale : SUB.invoice, { seq: row.invoice.seq }),
  ];
}

/** A refund's part: "Refund · Credit note CN-100", then "for Invoice #760". */
function refundParts(
  row: LedgerRow,
  t: TFunction,
  creditNote: (seq: number) => string,
): string[] {
  const parts = [
    row.creditNoteSeq === null
      ? t(SUB.refund)
      : t(SUB.refundNote, { note: creditNote(row.creditNoteSeq) }),
  ];
  if (row.invoice) parts.push(t(SUB.refundFor, { seq: row.invoice.seq }));
  return parts;
}

/** Money out: a supplier bill's "Medical PO #431 · bill 1631", else the expense's category. */
function paidOutParts(row: LedgerRow, t: TFunction, tClinic: TFunction): string[] {
  if (row.bill) {
    const key = row.bill.kind === 'medical_po' ? SUB.medicalBill : SUB.stockBill;
    return [t(key, { seq: row.bill.seq, bill: row.bill.billNo })];
  }
  if (!row.expenseCategory) return [];
  return [tClinic(CLINIC_KEYS.expenseCategories[row.expenseCategory])];
}

/**
 * The From / to cell's sub line (`payments.md:29`, H:5108): a receipt's
 * "Invoice #785" or "Sale · Invoice #785"; a refund's "Refund · Credit note
 * CN-100 · for Invoice #760"; money back "Money back"; an expense's category or
 * "Medical PO #431 · bill 1631"; then the pending credit it settled ("From
 * CR-1") and " · <note>" (a receipt's note stays off the line).
 */
export function ledgerSubLine(
  row: LedgerRow,
  t: TFunction,
  tClinic: TFunction,
  creditNote: (seq: number) => string,
): string {
  if (row.kind === 'receipt') return receiptParts(row, t).join(' · ');
  const parts: string[] = [];
  if (row.kind === 'refund') parts.push(...refundParts(row, t, creditNote));
  else if (row.kind === 'money_back') parts.push(t(SUB.moneyBack));
  else parts.push(...paidOutParts(row, t, tClinic));
  if (row.pendingCreditSeq !== null) {
    parts.push(t(SUB.fromCredit, { ref: displayId.pendingCredit(row.pendingCreditSeq) }));
  }
  if (row.note) parts.push(row.note);
  return parts.join(' · ');
}

/** "₹600 UPI" — one side of a logged edit. */
export function editSideLabel(
  side: PaymentEditSide,
  t: TFunction,
  tClinic: TFunction,
  formatPaise: (paise: number) => string,
): string {
  return t(PAYMENTS_KEYS.ledger.editSide, {
    amount: formatPaise(side.amount),
    modes: ledgerModesLabel(side.modes, tClinic),
  });
}

/**
 * "Today 11:05" / "27 Sep 18:40" — the day (Today on the clinic's today) and
 * the clock time, in the viewer's locale and hour cycle.
 */
export function useLedgerWhen(): (instant: string) => string {
  const { t } = useTranslation(PAYMENTS_NS);
  const { formatDate, prefs } = useLocaleFormat();
  return (instant) => {
    const time = formatDate(instant, {
      ...dateFormatOptions('time', prefs.hourCycle),
      hour: 'numeric',
      second: undefined,
    });
    if (clinicDateOf(instant) === clinicToday()) {
      return t(PAYMENTS_KEYS.ledger.today, { time });
    }
    return t(PAYMENTS_KEYS.ledger.dayTime, {
      day: formatDate(instant, { day: 'numeric', month: 'short' }),
      time,
    });
  };
}

/** The From / to sub line, worded for the viewer. */
export function useLedgerSubLine(): (row: LedgerRow) => string {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  return (row) => ledgerSubLine(row, t, tClinic, displayId.creditNote);
}
