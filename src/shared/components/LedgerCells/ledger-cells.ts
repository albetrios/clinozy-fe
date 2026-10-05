import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { PaymentMode, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LedgerRow,
  PaymentEditSide,
} from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_KIND_TONES } from '@/shared/clinic/clinic-tones.ts';

import { LEDGER_KEYS, LEDGER_NS } from './ledger-cells.constants.ts';

/*
 * What the ledger's cells say about an entry (`payments.md:29`, H:5096–5108) —
 * pure wording, and the hook that words the sub line for the viewer, so the
 * cells, the meta line, the phone rows, Day close's review and the CSV export
 * all word an entry the same way. When reads by the rooms' one time rule
 * (`useClinicClock`).
 */

const SUB = LEDGER_KEYS.ledger.sub;

/** The What pill: "Received" or "Paid", in the kind's tone. */
export function ledgerWhat(row: Pick<LedgerRow, 'direction' | 'kind'>): {
  labelKey: string;
  tone: Tone;
} {
  return {
    labelKey: LEDGER_KEYS.directions[row.direction],
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

/**
 * Why an entry can't be changed, or null while it can: a pending credit
 * settled it — "PAY-5601 · From CR-2", it is the credit's (H:5105) — or its
 * day is closed — "PAY-5509 · Day closed" (+ " · edited 2×", `S:87`).
 */
export function ledgerEntryLock(
  row: Pick<LedgerRow, 'seq' | 'locked' | 'pendingCreditSeq' | 'edits'>,
  t: TFunction,
): string | null {
  const ref = displayId.payment(row.seq);
  if (row.pendingCreditSeq !== null) {
    return t(LEDGER_KEYS.ledger.creditEntry, {
      ref,
      credit: displayId.pendingCredit(row.pendingCreditSeq),
    });
  }
  if (!row.locked) return null;
  return row.edits.length > 0
    ? t(LEDGER_KEYS.ledger.dayClosedEdited, { ref, count: row.edits.length })
    : t(LEDGER_KEYS.ledger.dayClosed, { ref });
}

/** "₹600 UPI" — one side of a logged edit. */
export function editSideLabel(
  side: PaymentEditSide,
  t: TFunction,
  tClinic: TFunction,
  formatPaise: (paise: number) => string,
): string {
  return t(LEDGER_KEYS.ledger.editSide, {
    amount: formatPaise(side.amount),
    modes: ledgerModesLabel(side.modes, tClinic),
  });
}

/** The From / to sub line, worded for the viewer. */
export function useLedgerSubLine(): (row: LedgerRow) => string {
  const { t } = useTranslation(LEDGER_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  return (row) => ledgerSubLine(row, t, tClinic, displayId.creditNote);
}
