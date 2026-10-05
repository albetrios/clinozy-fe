import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The ledger's words live in `payments`: the ledger is the Payments room's,
 * and Medical › Payments shows it limited to Medical (KICKOFF §6.7, §6.9).
 */
export const LEDGER_NS = I18N_NAMESPACES.payments;

/**
 * Key paths of the ledger's own words (`payments.md` › Copy, verbatim): its
 * columns, the What pill, the cells, an entry's row actions and its delete
 * confirm. The Payments room's `PAYMENTS_KEYS` composes these, so each key is
 * declared once.
 */
export const LEDGER_KEYS = {
  /** Column headers, also the meta line's labels and the Filters sections'. */
  columns: {
    ref: 'columns.ref',
    what: 'columns.what',
    when: 'columns.when',
    party: 'columns.party',
    mode: 'columns.mode',
    amount: 'columns.amount',
    by: 'columns.by',
  },
  /** "Received" / "Paid" — the What pill, and the Show chips. */
  directions: { received: 'directions.received', paid: 'directions.paid' },
  /** The What filter's chips — the contract's kind labels (`S:1378–1386`). */
  kinds: {
    receipt: 'kinds.receipt',
    refund: 'kinds.refund',
    expense: 'kinds.expense',
    money_back: 'kinds.money_back',
  },
  ledger: {
    /** "All entries loaded" — the plural noun the end line names. */
    records: 'ledger.records',
    /** "Edited 1× · last ₹600 UPI → ₹700 UPI" (plural). */
    edited: 'ledger.edited',
    /** "₹600 UPI" — one side of an edit. */
    editSide: 'ledger.editSide',
    /** "+ ₹600" / "− ₹260". */
    received: 'ledger.received',
    paid: 'ledger.paid',
    /** The From / to cell's sub line, piece by piece. */
    sub: {
      invoice: 'ledger.sub.invoice',
      sale: 'ledger.sub.sale',
      refund: 'ledger.sub.refund',
      refundNote: 'ledger.sub.refundNote',
      refundFor: 'ledger.sub.refundFor',
      moneyBack: 'ledger.sub.moneyBack',
      medicalBill: 'ledger.sub.medicalBill',
      stockBill: 'ledger.sub.stockBill',
      fromCredit: 'ledger.sub.fromCredit',
    },
    /** A closed day's row click: "PAY-5509 · Day closed" (+ " · edited 2×"). */
    dayClosed: 'ledger.dayClosed',
    dayClosedEdited: 'ledger.dayClosedEdited',
    /** A settled credit's entry: "PAY-5601 · From CR-2" — it is the credit's (H:5105). */
    creditEntry: 'ledger.creditEntry',
  },
  /** An open-day entry's row actions (`payments.md:34`). */
  rowActions: { edit: 'rowActions.edit', delete: 'rowActions.delete' },
  /** Delete an entry (`payments.md:34, 282–294`). */
  deleteEntry: {
    title: 'deleteEntry.title',
    effect: 'deleteEntry.effect',
    effectInvoice: 'deleteEntry.effectInvoice',
    reasons: {
      twice: 'deleteEntry.reasons.twice',
      amount: 'deleteEntry.reasons.amount',
      party: 'deleteEntry.reasons.party',
    },
    removed: 'deleteEntry.removed',
    removedInvoice: 'deleteEntry.removedInvoice',
  },
} as const;
