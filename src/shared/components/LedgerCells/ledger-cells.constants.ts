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
    /** A closed day's entry undone — the What pill of a `reversal` entry. */
    reversal: 'kinds.reversal',
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
      /** "Medical PO #431" / "Stock PO #8" — a supplier bill without its bill number. */
      medicalOrder: 'ledger.sub.medicalOrder',
      stockPurchase: 'ledger.sub.stockPurchase',
      fromCredit: 'ledger.sub.fromCredit',
      /** "Reversed" — an entry a reversal undid. */
      reversed: 'ledger.sub.reversed',
    },
    /** A closed day's row click: "PAY-5509 · Day closed" (+ " · edited 2×"). */
    dayClosed: 'ledger.dayClosed',
    dayClosedEdited: 'ledger.dayClosedEdited',
    /** A settled credit's entry: "PAY-5601 · From CR-2" — it is the credit's (H:5105). */
    creditEntry: 'ledger.creditEntry',
    /** A refund's or a reversal's row click: its money is another write's — "PAY-9 · …". */
    fixedEntry: 'ledger.fixedEntry',
    /** The ledger's search — the person, the payee or the PAY- number (D81). */
    search: 'ledger.search',
    /** The footer: "13 entries" (plural) — the server's count over the filters. */
    count: 'ledger.count',
  },
  /** An entry's row actions (`payments.md:34`): Edit and Delete on an open day, Reverse on a closed one. */
  rowActions: {
    edit: 'rowActions.edit',
    delete: 'rowActions.delete',
    reverse: 'rowActions.reverse',
  },
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
    /** clinozy-be's `409` reasons for a delete, in the room's words. */
    blocked: {
      dayClosed: 'deleteEntry.blocked.dayClosed',
      moreThanPaid: 'deleteEntry.blocked.moreThanPaid',
    },
  },
  /** Reverse a closed day's entry (`POST /app/payments/:id/reverse`, research §2). */
  reverseEntry: {
    title: 'reverseEntry.title',
    effect: 'reverseEntry.effect',
    action: 'reverseEntry.action',
    /** "PAY-8 reversed · PAY-9". */
    reversed: 'reverseEntry.reversed',
    /** clinozy-be's `409` reasons for a reversal, in the room's words. */
    blocked: {
      alreadyReversed: 'reverseEntry.blocked.alreadyReversed',
      dayOpen: 'reverseEntry.blocked.dayOpen',
      dayClosed: 'reverseEntry.blocked.dayClosed',
    },
  },
} as const;
