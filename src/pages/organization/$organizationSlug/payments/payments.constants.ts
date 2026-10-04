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
    /** "Adjusted · Invoice #785" — a credit used on a bill in full (Q-G9). */
    settledInvoice: 'pending.settledInvoice',
    /** "₹500 of CR-2 adjusted on invoice #785" — Use on next bill (Q-G9). */
    adjustedOn: 'pending.adjustedOn',
    /** "Nothing due for Tanvi Shah to adjust against". */
    nothingDue: 'pending.nothingDue',
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
  /** Add pending / Edit pending (`payments.md:152–168, 240–252`). */
  credit: {
    title: 'credit.title',
    titleEdit: 'credit.titleEdit',
    sub: 'credit.sub',
    subEdit: 'credit.subEdit',
    /** The two steps: "Which way" · "Why". */
    steps: { way: 'credit.steps.way', why: 'credit.steps.why' },
    way: 'credit.way',
    who: 'credit.who',
    /** "Search patients, contacts or suppliers". */
    whoPlaceholder: 'credit.whoPlaceholder',
    /** "Add" — the create row reads "Add “q”" and keeps the typed name. */
    add: 'credit.add',
    groups: {
      patients: 'credit.groups.patients',
      contacts: 'credit.groups.contacts',
      suppliers: 'credit.groups.suppliers',
    },
    /** Each party's line: "Patient · #3441", "Contact · +91 …", "Clinic vendor", "Medical supplier". */
    parties: {
      patient: 'credit.parties.patient',
      contact: 'credit.parties.contact',
      contactPhone: 'credit.parties.contactPhone',
      vendor: 'credit.parties.vendor',
      supplier: 'credit.parties.supplier',
    },
    amount: 'credit.amount',
    reason: 'credit.reason',
    invoice: 'credit.invoice',
    /** "optional · links the credit to a bill". */
    invoiceHint: 'credit.invoiceHint',
    noInvoice: 'credit.noInvoice',
    /** "₹1,534 · paid" / "₹1,000 · ₹600 due". */
    invoicePaid: 'credit.invoicePaid',
    invoiceDue: 'credit.invoiceDue',
    settleBy: 'credit.settleBy',
    note: 'credit.note',
    notePlaceholder: {
      give: 'credit.notePlaceholder.give',
      take: 'credit.notePlaceholder.take',
    },
    /** The save's checks, in order (`payments.md:164`). */
    problems: {
      who: 'credit.problems.who',
      amount: 'credit.problems.amount',
      reason: 'credit.problems.reason',
      otherNote: 'credit.problems.otherNote',
    },
    /** "Save · give later" / "Save · take later". */
    save: { give: 'credit.save.give', take: 'credit.save.take' },
    saveEdit: 'credit.saveEdit',
    /** "Give ₹500 back to Tanvi Shah" / "Take ₹800 from Medline Surgicals". */
    summary: { give: 'credit.summary.give', take: 'credit.summary.take' },
    /** "CR-3 saved · give ₹500 to Tanvi Shah". */
    saved: { give: 'credit.saved.give', take: 'credit.saved.take' },
    /** "CR-1 updated". */
    updated: 'credit.updated',
  },
  /** Day close (`payments.md:57–80, 182–194, 268–280, 326–331`; KICKOFF §6.9). */
  dayClose: {
    title: 'dayClose.title',
    /** The day dropdown's name. */
    day: 'dayClose.day',
    /** The status pill: "Open", "Open · auto-closes in 15 h", "Closed by Riya S.", "Force-closed". */
    status: {
      open: 'dayClose.status.open',
      openAuto: 'dayClose.status.openAuto',
      closedBy: 'dayClose.status.closedBy',
      closed: 'dayClose.status.closed',
      forceClosed: 'dayClose.status.forceClosed',
    },
    /** "3 entries on 3 Oct" (plural). */
    entries: 'dayClose.entries',
    /** "2 Oct not closed · 15 h left · Review" (plural) and its tooltip. */
    openDay: 'dayClose.openDay',
    openDayTitle: 'dayClose.openDayTitle',
    previous: 'dayClose.previous',
    /** A previous close: "Cash ₹7,310", "Auto-closed", "Review 25 Sep". */
    previousCash: 'dayClose.previousCash',
    previousAuto: 'dayClose.previousAuto',
    previousTitle: 'dayClose.previousTitle',
    closeDay: 'dayClose.closeDay',
    countFirst: 'dayClose.countFirst',
    /** "Day closed · summary sent to admin on WhatsApp". */
    closed: 'dayClose.closed',
    reopened: 'dayClose.reopened',
    /** The gate (H:5114–5116). */
    gate: {
      title: 'dayClose.gate.title',
      sources: {
        default_float: 'dayClose.gate.sources.default_float',
        carried: 'dayClose.gate.sources.carried',
        recounted: 'dayClose.gate.sources.recounted',
      },
      recount: 'dayClose.gate.recount',
      recountLabel: 'dayClose.gate.recountLabel',
      recountTitle: 'dayClose.gate.recountTitle',
      /** "Accept ₹2,000" / "Accept recount". */
      accept: 'dayClose.gate.accept',
      acceptRecount: 'dayClose.gate.acceptRecount',
      starting: 'dayClose.gate.starting',
      /** "Opening cash ₹2,000 accepted · stamped 09:12". */
      accepted: 'dayClose.gate.accepted',
    },
    /** The working day's strip (`payments.md:73–80`). */
    strip: {
      opening: 'dayClose.strip.opening',
      /** "Accepted by Riya S. · 09:12". */
      acceptedBy: 'dayClose.strip.acceptedBy',
      cashInOut: 'dayClose.strip.cashInOut',
      /** "+₹0" · "−₹260". */
      cashIn: 'dayClose.strip.cashIn',
      cashOut: 'dayClose.strip.cashOut',
      expected: 'dayClose.strip.expected',
      counted: 'dayClose.strip.counted',
      countPlaceholder: 'dayClose.strip.countPlaceholder',
      countLabel: 'dayClose.strip.countLabel',
      netByMode: 'dayClose.strip.netByMode',
      /** "In ₹600 · out ₹0". */
      modeTitle: 'dayClose.strip.modeTitle',
      /** "Farah A. · 1 receipt · ₹600" (plural). */
      staffTitle: 'dayClose.strip.staffTitle',
    },
    /** The closed day's report (H:5117–5121). */
    report: {
      /** "Today is closed" / "25 Sep is closed". */
      title: 'dayClose.report.title',
      closedBy: 'dayClose.report.closedBy',
      autoClosed: 'dayClose.report.autoClosed',
      reopen: 'dayClose.report.reopen',
      acceptedBy: 'dayClose.report.acceptedBy',
      takenAsExpected: 'dayClose.report.takenAsExpected',
      collected: 'dayClose.report.collected',
      /** "1 received" / "2 paid" (plural). */
      received: 'dayClose.report.received',
      paidOut: 'dayClose.report.paidOut',
      paid: 'dayClose.report.paid',
      cashCounted: 'dayClose.report.cashCounted',
      expected: 'dayClose.report.expected',
      difference: 'dayClose.report.difference',
      matched: 'dayClose.report.matched',
      extra: 'dayClose.report.extra',
      short: 'dayClose.report.short',
      log: 'dayClose.report.log',
      logAccepted: 'dayClose.report.logAccepted',
      logRecounted: 'dayClose.report.logRecounted',
      /** "3 of 3 entries reviewed" (plural on the total). */
      logReviewed: 'dayClose.report.logReviewed',
      logMatched: 'dayClose.report.logMatched',
      logExtra: 'dayClose.report.logExtra',
      logShort: 'dayClose.report.logShort',
      logClosed: 'dayClose.report.logClosed',
      logAuto: 'dayClose.report.logAuto',
    },
    /** "Review every entry" (`payments.md:57–67`). */
    review: {
      title: 'dayClose.review.title',
      /** "0 of 3 checked" (plural on the total) / "No entries". */
      progress: 'dayClose.review.progress',
      none: 'dayClose.review.none',
      empty: 'dayClose.review.empty',
      check: 'dayClose.review.check',
      /** The State pill: "Can edit", "Day closed", "From CR-2" — and the tooltips. */
      states: {
        canEdit: 'dayClose.review.states.canEdit',
        canEditTitle: 'dayClose.review.states.canEditTitle',
        dayClosed: 'dayClose.review.states.dayClosed',
        dayClosedTitle: 'dayClose.review.states.dayClosedTitle',
        fromCredit: 'dayClose.review.states.fromCredit',
      },
    },
  },
} as const;

/** The Day close drawer's test id — the `/payments/day-close` manifest names it. */
export const DAY_CLOSE_TEST_ID = 'day-close-drawer';

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
