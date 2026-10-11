/**
 * The Payments ledger as the room's tests see clinozy-be answer it: six entries of one day at
 * the clinic (rupees, public ids), newest first — Kavya's receipt PAY-5 against invoice #5, the
 * tea expense PAY-310, a supplier bill PAY-15 for Stock PO #2, a credit used on a bill PAY-6, the
 * reversal PAY-9 of a closed day's expense, and that expense PAY-305 itself — and `listLedger` /
 * `fetchLedgerCount` over them, which a suite swaps in with `vi.mock`.
 */
import type { LedgerListParams, LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

/** 10:30 on 10 Oct, clinic time — the entries were recorded this morning. */
export const LEDGER_NOW = new Date('2026-10-10T05:00:00Z');

/** Money out to a payee, by `seq`: no person, no invoice. */
const paidOut = (overrides: Partial<LedgerRow>): LedgerRow =>
  ledgerRow({
    direction: 'paid',
    kind: 'expense',
    contactId: null,
    contact: null,
    patientId: null,
    invoiceId: null,
    invoice: null,
    reference: null,
    note: null,
    editCount: 0,
    lastEdit: null,
    ...overrides,
  });

/** The closed day's expense a reversal undid. */
export const SETTLED_EXPENSE = paidOut({
  id: 'pay_closed000000000000000',
  seq: 305,
  amount: 120,
  splits: [{ mode: 'cash', amount: 120 }],
  paidAt: '2026-10-02T06:00:00.000Z',
  partyName: 'Soprano service',
  payeeName: 'Soprano service',
  expenseCategory: 'maintenance',
  isSettled: true,
  reversedByPaymentId: 'pay_reversal0000000000000',
});

/** The entries, newest first. */
export function seededLedger(): LedgerRow[] {
  return [
    paidOut({
      id: 'pay_supplier0000000000000',
      seq: 15,
      kind: 'supplier_bill',
      amount: 250,
      splits: [{ mode: 'cash', amount: 250 }],
      paidAt: '2026-10-10T04:55:00.000Z',
      partyName: 'ZZ Research Vendor',
      payeeName: 'ZZ Research Vendor',
      bill: {
        kind: 'stock_po',
        purchaseId: 'spur_ft5aosl5u6tyxqidd2e1a',
        seq: 2,
        billNo: 'ZZ-INV-2',
      },
    }),
    paidOut({
      id: 'pay_reversal0000000000000',
      seq: 9,
      kind: 'reversal',
      direction: 'received',
      amount: 120,
      splits: [{ mode: 'cash', amount: 120 }],
      paidAt: '2026-10-10T04:50:00.000Z',
      // A reversal of money out names nobody on the API.
      partyName: '',
      note: 'Wrong amount',
      reversesPaymentId: SETTLED_EXPENSE.id,
    }),
    paidOut({
      id: 'pay_7tq2m4x8v1b5n9c3z6kwa',
      seq: 310,
      amount: 260,
      splits: [{ mode: 'cash', amount: 260 }],
      paidAt: '2026-10-10T04:45:00.000Z',
      partyName: 'Tea & snacks',
      payeeName: 'Tea & snacks',
      expenseCategory: 'misc',
    }),
    ledgerRow({
      id: 'pay_credit000000000000000',
      seq: 6,
      amount: 50,
      splits: [{ mode: 'credit', amount: 50 }],
      paidAt: '2026-10-10T04:50:00.000Z',
      pendingCreditSeq: 1,
      reference: null,
      note: null,
      editCount: 0,
      lastEdit: null,
    }),
    ledgerRow(),
    SETTLED_EXPENSE,
  ];
}

/** The ledger a suite's double answers from; reset it per test with {@link seededLedger}. */
export const ledgerWorld: { rows: LedgerRow[] } = { rows: [] };

/** `listLedger` and `fetchLedgerCount` over {@link ledgerWorld} — one page, every row. */
export function ledgerApiDouble() {
  return {
    listLedger: async (_params: LedgerListParams) => ({
      rows: [...ledgerWorld.rows],
      next: null,
      total: ledgerWorld.rows.length,
    }),
    fetchLedgerCount: async (_params: LedgerListParams) => ledgerWorld.rows.length,
  };
}
