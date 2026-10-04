import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { RoomFilterFields } from '@/shared/components/RoomToolbar/index.ts';

import { LEDGER_FILTER_VALUES } from './payments.search.ts';

/** The Payments room's i18n namespace — the ledger, Pending and their drawers. */
export const PAYMENTS_NS = I18N_NAMESPACES.payments;

/**
 * The Payments room's copy, verbatim from `payments.md` › Copy (KICKOFF §6.9).
 * The payment modes, invoice types and expense categories are the shared clinic
 * vocabulary (`CLINIC_KEYS`).
 */
export const PAYMENTS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** The room's two tabs (`payments.md:17`) and their accessible name. */
  tabs: { label: 'tabs.label', ledger: 'tabs.ledger', pending: 'tabs.pending' },
  search: { placeholder: 'search.placeholder', label: 'search.label' },
  toolbar: {
    dayClose: 'toolbar.dayClose',
    pay: 'toolbar.pay',
    payTitle: 'toolbar.payTitle',
    receive: 'toolbar.receive',
    receiveTitle: 'toolbar.receiveTitle',
    addPending: 'toolbar.addPending',
    give: 'toolbar.give',
    giveSub: 'toolbar.giveSub',
    take: 'toolbar.take',
    takeSub: 'toolbar.takeSub',
  },
  /** Column headers, also the meta line's labels and the Filters sections'. */
  columns: {
    ref: 'columns.ref',
    what: 'columns.what',
    when: 'columns.when',
    party: 'columns.party',
    mode: 'columns.mode',
    amount: 'columns.amount',
    by: 'columns.by',
    who: 'columns.who',
    way: 'columns.way',
    why: 'columns.why',
    since: 'columns.since',
    state: 'columns.state',
  },
  /** The Filters popover's "Show" section: All · Received · Paid. */
  filters: { show: 'filters.show', all: 'filters.all' },
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
    /** "Today 11:05". */
    today: 'ledger.today',
    /** "27 Sep 18:40". */
    dayTime: 'ledger.dayTime',
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
  rowActions: {
    edit: 'rowActions.edit',
    delete: 'rowActions.delete',
    giveBack: 'rowActions.giveBack',
    gotBack: 'rowActions.gotBack',
    useOnBill: 'rowActions.useOnBill',
  },
  bulk: {
    export: 'bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'bulk.exported',
  },
  /** The ledger and Pending empty states (`payments.md:398–399`). */
  empty: {
    ledgerTitle: 'empty.ledgerTitle',
    pendingTitle: 'empty.pendingTitle',
    description: 'empty.description',
    receive: 'empty.receive',
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
  },
  /** A dialog route's record, as "<Record> not found · it may have been deleted" names it (`S:115`). */
  dialog: {
    record: 'dialog.record',
    credit: 'dialog.credit',
    /** A save the closed day refused: the drawer turns read-only (`S:1708–1710`). */
    dayClosed: 'dialog.dayClosed',
  },
  /** Receive payment (`payments.md:95–110, 198–210`). */
  receive: {
    title: 'receive.title',
    titleEdit: 'receive.titleEdit',
    sub: 'receive.sub',
    subEdit: 'receive.subEdit',
    /** The one section: "Who is paying". */
    section: 'receive.section',
    branch: 'receive.branch',
    invoice: 'receive.invoice',
    /** "2 open" — the invoice field's hint while more than one is open (plural). */
    invoiceOpen: 'receive.invoiceOpen',
    /** "#784 · ₹8,550". */
    invoiceChip: 'receive.invoiceChip',
    pickPatientFirst: 'receive.pickPatientFirst',
    nothingDue: 'receive.nothingDue',
    amount: 'receive.amount',
    mode: 'receive.mode',
    amountColumn: 'receive.amountColumn',
    /** "Split · add a mode" — the field draws the "+". */
    split: 'receive.split',
    /** "Total ₹8,550" / "Total ₹8,550 · due ₹8,550". */
    total: 'receive.total',
    totalDue: 'receive.totalDue',
    reference: 'receive.reference',
    referenceHint: 'receive.referenceHint',
    referencePlaceholder: 'receive.referencePlaceholder',
    note: 'receive.note',
    notePlaceholder: 'receive.notePlaceholder',
    quickFill: {
      full: 'receive.quickFill.full',
      half: 'receive.quickFill.half',
      cashUpi: 'receive.quickFill.cashUpi',
    },
    /** "Record ₹8,550" / "Save ₹600". */
    save: 'receive.save',
    saveEdit: 'receive.saveEdit',
    /** "UPI · ₹8,550". */
    summary: 'receive.summary',
    received: 'receive.received',
    updated: 'receive.updated',
    enterAmount: 'receive.enterAmount',
    pickPatient: 'receive.pickPatient',
    /** "More than the ₹8,550 due" (AMBER copy, KICKOFF §6.9). */
    aboveDue: 'receive.aboveDue',
  },
  /** Send payment (`payments.md:112–130, 212–224`). */
  send: {
    title: 'send.title',
    titleEdit: 'send.titleEdit',
    sub: 'send.sub',
    steps: {
      bill: 'send.steps.bill',
      expense: 'send.steps.expense',
      payment: 'send.steps.payment',
    },
    bill: 'send.bill',
    /** "3 open · search PO #, supplier or bill no" (plural). */
    billHint: 'send.billHint',
    billPlaceholder: 'send.billPlaceholder',
    otherSpend: 'send.otherSpend',
    otherSpendSub: 'send.otherSpendSub',
    groups: {
      other: 'send.groups.other',
      medical: 'send.groups.medical',
      stock: 'send.groups.stock',
    },
    /** "Medical PO #431 · Shree Ramdev Medical Agency" / "Stock PO #15 · Cranix Pharma". */
    billLabel: { medical: 'send.billLabel.medical', stock: 'send.billLabel.stock' },
    /** "Medical PO #431" / "Stock PO #15" — the paid toast's bill. */
    billRef: { medical: 'send.billRef.medical', stock: 'send.billRef.stock' },
    /** "Bill 1631" — before the age on a bill's sub line ("Bill 1631 · 8 days pending"). */
    billNo: 'send.billNo',
    /** "8 days pending" (plural) / "Today". */
    daysPending: 'send.daysPending',
    pendingToday: 'send.pendingToday',
    oldest: 'send.oldest',
    /** "#15 · Cranix · ₹1,710 · 12 days pending". */
    oldestChip: 'send.oldestChip',
    category: 'send.category',
    paidTo: 'send.paidTo',
    paidToPlaceholder: 'send.paidToPlaceholder',
    note: 'send.note',
    notePlaceholder: 'send.notePlaceholder',
    amount: 'send.amount',
    date: 'send.date',
    mode: 'send.mode',
    files: 'send.files',
    filesDrop: 'send.filesDrop',
    filesHint: 'send.filesHint',
    filesRemove: 'send.filesRemove',
    /** The quick "Paid to" chip that is a word, not a name: "Electricity". */
    electricity: 'send.electricity',
    presets: { tea: 'send.presets.tea', courier: 'send.presets.courier' },
    save: 'send.save',
    saveEdit: 'send.saveEdit',
    another: 'send.another',
    added: 'send.added',
    paidBill: 'send.paidBill',
    saved: 'send.saved',
    missing: 'send.missing',
  },
  pending: {
    /** "All pending loaded". */
    records: 'pending.records',
    patient: 'pending.patient',
    party: 'pending.party',
    ways: { give: 'pending.ways.give', take: 'pending.ways.take' },
    wayTitles: { give: 'pending.wayTitles.give', take: 'pending.wayTitles.take' },
    states: {
      open: 'pending.states.open',
      given_back: 'pending.states.given_back',
      got_back: 'pending.states.got_back',
      used: 'pending.states.used',
    },
    /** "Returned · Today". */
    settledToday: 'pending.settledToday',
    /** "₹200 adjusted". */
    adjusted: 'pending.adjusted',
    /** "From PAY-5466 · Received". */
    source: 'pending.source',
    invoice: 'pending.invoice',
    byHand: 'pending.byHand',
    /** The credit delete confirm: "Delete this pending?" and "CR-2 deleted". */
    deleteTitle: 'pending.deleteTitle',
    deleted: 'pending.deleted',
    /** The reason chips (`payments.md:159`), by the stored chip. */
    reasons: {
      charged_twice: 'pending.reasons.charged_twice',
      advance_not_used: 'pending.reasons.advance_not_used',
      package_cancelled: 'pending.reasons.package_cancelled',
      overpaid: 'pending.reasons.overpaid',
      returned_items: 'pending.reasons.returned_items',
      short_payment: 'pending.reasons.short_payment',
      damaged_goods: 'pending.reasons.damaged_goods',
      advance_given: 'pending.reasons.advance_given',
      loan_to_staff: 'pending.reasons.loan_to_staff',
      other: 'pending.reasons.other',
    },
  },
} as const;

/** The ledger's table id: the test-id prefix and the device prefs' key. */
export const LEDGER_TABLE_ID = 'payments';

/** The Pending table's id. */
export const PENDING_TABLE_ID = 'payments-pending';

/**
 * The ledger's Filters by URL key, in the popover's order (`payments.md:39`):
 * Show (one pick, "All" by default), What, Mode, then Created. Room-only, so it
 * stays out of `payments.search.ts`, which rides the entry chunk.
 */
export const LEDGER_FILTER_FIELDS = {
  direction: { kind: 'options', values: LEDGER_FILTER_VALUES.direction, single: true },
  kind: { kind: 'options', values: LEDGER_FILTER_VALUES.kind },
  mode: { kind: 'options', values: LEDGER_FILTER_VALUES.mode },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;
