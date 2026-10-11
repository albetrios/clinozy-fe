import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { PaymentMode, Tone } from '@/shared/api/app/app-schema.ts';
import type { LedgerRow, PaymentEditSide } from '@/shared/api/app/payments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PAYMENT_KIND_TONES } from '@/shared/app/app-tones.ts';

import { LEDGER_KEYS, LEDGER_NS } from './ledger-cells.constants.ts';

/*
 * What the ledger's cells say about an entry (`payments.md:29`, H:5096–5108) —
 * pure wording, and the hook that words the sub line for the viewer, so the
 * cells, the meta line, the phone rows, Day close's review and the CSV export
 * all word an entry the same way. When reads by the rooms' one time rule
 * (`useAppClock`).
 */

const SUB = LEDGER_KEYS.ledger.sub;

/**
 * The What pill: "Received" or "Paid", in the kind's tone — a reversal reads "Reversal", whichever
 * way its money went.
 */
export function ledgerWhat(row: Pick<LedgerRow, 'direction' | 'kind'>): {
  labelKey: string;
  tone: Tone;
} {
  return {
    labelKey:
      row.kind === 'reversal'
        ? LEDGER_KEYS.kinds.reversal
        : LEDGER_KEYS.directions[row.direction],
    tone: PAYMENT_KIND_TONES[row.kind],
  };
}

/** The modes of an entry's split rows, each once: "Cash + UPI" reads two. */
export function ledgerModes(row: Pick<LedgerRow, 'splits'>): PaymentMode[] {
  return [...new Set(row.splits.map((split) => split.mode))];
}

/** "Cash + UPI" — the modes as the Mode pill joins them (`payments.md:29`). */
export function ledgerModesLabel(modes: readonly PaymentMode[], tApp: TFunction): string {
  return modes.map((mode) => tApp(APP_KEYS.paymentModes[mode])).join(' + ');
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

/** A supplier bill's "Medical PO #431 · bill 1631", or "Stock PO #8" while it has no bill number. */
function billPart(bill: NonNullable<LedgerRow['bill']>, t: TFunction): string {
  const medical = bill.kind === 'medical_po';
  if (bill.billNo) {
    return t(medical ? SUB.medicalBill : SUB.stockBill, {
      seq: bill.seq,
      bill: bill.billNo,
    });
  }
  return t(medical ? SUB.medicalOrder : SUB.stockPurchase, { seq: bill.seq });
}

/** Money out: a supplier bill's "Medical PO #431 · bill 1631", else the expense's category. */
function paidOutParts(row: LedgerRow, t: TFunction, tApp: TFunction): string[] {
  if (row.bill) return [billPart(row.bill, t)];
  if (!row.expenseCategory) return [];
  return [tApp(APP_KEYS.expenseCategories[row.expenseCategory])];
}

/** A reversal's part: what the entry it undid named — its invoice or its supplier bill. */
function reversalParts(row: LedgerRow, t: TFunction): string[] {
  if (row.invoice) return [t(SUB.invoice, { seq: row.invoice.seq })];
  return row.bill ? [billPart(row.bill, t)] : [];
}

/** The kind's own parts of the sub line, before the credit, the note and the reversal mark. */
function kindParts(
  row: LedgerRow,
  t: TFunction,
  tApp: TFunction,
  creditNote: (seq: number) => string,
): string[] {
  if (row.kind === 'refund') return refundParts(row, t, creditNote);
  if (row.kind === 'money_back') return [t(SUB.moneyBack)];
  if (row.kind === 'reversal') return reversalParts(row, t);
  return paidOutParts(row, t, tApp);
}

/**
 * The From / to cell's sub line (`payments.md:29`, H:5108): a receipt's
 * "Invoice #785" or "Sale · Invoice #785"; a refund's "Refund · Credit note
 * CN-100 · for Invoice #760"; money back "Money back"; an expense's category or
 * "Medical PO #431 · bill 1631"; a reversal's invoice or bill and its reason (its note); then
 * the pending credit it settled ("From CR-1" — a credit used on a bill is a receipt) and
 * " · <note>" (a receipt's note stays off the line) — and "Reversed" once a reversal undid it.
 */
export function ledgerSubLine(
  row: LedgerRow,
  t: TFunction,
  tApp: TFunction,
  creditNote: (seq: number) => string,
): string {
  const receipt = row.kind === 'receipt';
  const parts = receipt ? receiptParts(row, t) : kindParts(row, t, tApp, creditNote);
  if (row.pendingCreditSeq !== null) {
    parts.push(t(SUB.fromCredit, { ref: displayId.pendingCredit(row.pendingCreditSeq) }));
  }
  if (row.note && !receipt) parts.push(row.note);
  if (row.reversedByPaymentId !== null) parts.push(t(SUB.reversed));
  return parts.join(' · ');
}

/**
 * Why an entry can't be changed, or null while it can: a pending credit
 * settled it — "PAY-5601 · From CR-2", it is the credit's (H:5105) — or its
 * day is closed — "PAY-5509 · Day closed" (+ " · edited 2×", `S:87`).
 */
export function ledgerEntryLock(
  row: Pick<LedgerRow, 'seq' | 'isSettled' | 'pendingCreditSeq' | 'editCount'>,
  t: TFunction,
): string | null {
  const ref = displayId.payment(row.seq);
  if (row.pendingCreditSeq !== null) {
    return t(LEDGER_KEYS.ledger.creditEntry, {
      ref,
      credit: displayId.pendingCredit(row.pendingCreditSeq),
    });
  }
  if (!row.isSettled) return null;
  return row.editCount > 0
    ? t(LEDGER_KEYS.ledger.dayClosedEdited, { ref, count: row.editCount })
    : t(LEDGER_KEYS.ledger.dayClosed, { ref });
}

/**
 * Whether an open day's entry opens in a drawer to be changed: what Receive and Send record — a
 * receipt, an expense, a supplier bill. A refund's and a reversal's money is another write's (the
 * server keeps it, a `400`): they are deleted on their day, never edited.
 */
export function ledgerEntryEditable(row: Pick<LedgerRow, 'kind'>): boolean {
  return row.kind === 'receipt' || row.kind === 'expense' || row.kind === 'supplier_bill';
}

/** A refund's or a reversal's row click: "PAY-9 · its money can’t be changed · delete it on its day". */
export function ledgerEntryFixed(row: Pick<LedgerRow, 'seq'>, t: TFunction): string {
  return t(LEDGER_KEYS.ledger.fixedEntry, { ref: displayId.payment(row.seq) });
}

/**
 * Whether a closed day's entry can be reversed (`POST …/reverse`): its day is closed, it is no
 * reversal itself, and nothing reversed it yet.
 */
export function ledgerEntryReversible(
  row: Pick<LedgerRow, 'isSettled' | 'kind' | 'reversedByPaymentId'>,
): boolean {
  return row.isSettled && row.kind !== 'reversal' && row.reversedByPaymentId === null;
}

/** "₹600 UPI" — one side of a logged edit (rupees). */
export function editSideLabel(
  side: PaymentEditSide,
  t: TFunction,
  tApp: TFunction,
  formatRupees: (rupees: number) => string,
): string {
  return t(LEDGER_KEYS.ledger.editSide, {
    amount: formatRupees(side.amount),
    modes: ledgerModesLabel(side.modes, tApp),
  });
}

/** The From / to sub line, worded for the viewer. */
export function useLedgerSubLine(): (row: LedgerRow) => string {
  const { t } = useTranslation(LEDGER_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return (row) => ledgerSubLine(row, t, tApp, displayId.creditNote);
}
