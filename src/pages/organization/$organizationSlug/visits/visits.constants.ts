import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { BodyPart } from '@/shared/api/clinic/clinic-schema.ts';
import type { VisitStage } from '@/shared/api/clinic/visits-contracts.ts';
import type { VisitTab } from '@/shared/clinic/visit-access.ts';

/**
 * The Visit sheet reads Today's namespace — it is Today's module (`today`,
 * KICKOFF §4) and opens from its lanes, so the copy loads with either.
 */
export const VISIT_NS = I18N_NAMESPACES.today;

/** The History filters (`today.md:251`): All · Clinical · Money · Messages · Audit. */
export const VISIT_HISTORY_FILTERS = [
  'all',
  'clinical',
  'money',
  'messages',
  'audit',
] as const;
/** One History filter. */
export type VisitHistoryFilter = (typeof VISIT_HISTORY_FILTERS)[number];

/** What a History row is, by its kind pill. */
export type VisitHistoryKind =
  | 'visit'
  | 'consult'
  | 'session'
  | 'photo'
  | 'invoice'
  | 'payment'
  | 'package'
  | 'message'
  | 'lead'
  | 'change';

/** The tabs in their order (`today.md:135`). */
export const VISIT_TABS: readonly VisitTab[] = [
  'timeline',
  'consult',
  'treatment',
  'checkout',
];

/** The Visit sheet's copy (`today.md` › Copy; KICKOFF §6.13), verbatim. */
export const VISIT_KEYS = {
  /** "Visit" — the not-found toast's record. */
  record: 'visit.record',
  /** The full-height strip at the inline start (aria-label and title). */
  closeStrip: 'visit.closeStrip',
  kind: { patient: 'visit.kind.patient', lead: 'visit.kind.lead' },
  /** "F" · "M" · "O" — the meta line's first part. */
  gender: {
    female: 'visit.gender.female',
    male: 'visit.gender.male',
    other: 'visit.gender.other',
  },
  chips: {
    /** "Laser pack · 3 of 6 left". */
    pack: 'visit.chips.pack',
    /** "Due ₹1,200". */
    due: 'visit.chips.due',
    /** "Consent: data ✓ · photos ✓ · marketing ✗". */
    consent: 'visit.chips.consent',
    /** "Visit: With doctor · since 10:40". */
    stage: 'visit.chips.stage',
  },
  stages: {
    waiting: 'visit.stages.waiting',
    with_doctor: 'visit.stages.withDoctor',
    treatment: 'visit.stages.treatment',
    checkout: 'visit.stages.checkout',
    pharmacy: 'visit.stages.pharmacy',
    done: 'visit.stages.done',
  } satisfies Record<VisitStage, string>,
  fullProfile: 'visit.fullProfile',
  close: 'visit.close',
  /** The tab row's name. */
  tabsLabel: 'visit.tabsLabel',
  tabs: {
    timeline: 'visit.tabs.timeline',
    consult: 'visit.tabs.consult',
    treatment: 'visit.tabs.treatment',
    checkout: 'visit.tabs.checkout',
  } satisfies Record<VisitTab, string>,
  /** "All changes saved 10:42". */
  saved: 'visit.saved',
  /** The sheet's title while it loads ("Loading the visit…"). */
  loading: 'visit.loading',
  /** "the visit" — what the bars stand for ("Loading the visit…", the shared sentence). */
  loadingName: 'visit.loadingName',
  /** A lead's visit: the records need a patient record first. */
  needsPatient: 'visit.needsPatient',
  history: {
    show: 'visit.history.show',
    filters: {
      all: 'visit.history.filters.all',
      clinical: 'visit.history.filters.clinical',
      money: 'visit.history.filters.money',
      messages: 'visit.history.filters.messages',
      audit: 'visit.history.filters.audit',
    } satisfies Record<VisitHistoryFilter, string>,
    kinds: {
      visit: 'visit.history.kinds.visit',
      consult: 'visit.history.kinds.consult',
      session: 'visit.history.kinds.session',
      photo: 'visit.history.kinds.photo',
      invoice: 'visit.history.kinds.invoice',
      payment: 'visit.history.kinds.payment',
      package: 'visit.history.kinds.package',
      message: 'visit.history.kinds.message',
      lead: 'visit.history.kinds.lead',
      change: 'visit.history.kinds.change',
    } satisfies Record<VisitHistoryKind, string>,
    /** "Today 10:40" — a row of today with its time. */
    today: 'visit.history.today',
    /** "Today" — a row of today with a day only. */
    todayOnly: 'visit.history.todayOnly',
    rows: {
      /** "Melasma consult · Completed". */
      visit: 'visit.history.rows.visit',
      /** "Dr. Mavani · Rx 3 items". */
      consult: 'visit.history.rows.consult',
      /** "Laser 3 of 6 · Kiran · 18 J/cm², 15 mm spot". */
      session: 'visit.history.rows.session',
      /** "Clinic invoice #781 · ₹8,500 · ₹1,200 due". */
      invoice: 'visit.history.rows.invoice',
      invoicePaid: 'visit.history.rows.invoicePaid',
      /** "₹4,200 UPI · PAY-211". */
      payment: 'visit.history.rows.payment',
      /** "6-session laser pack · 3 of 6 used". */
      package: 'visit.history.rows.package',
      /** "WhatsApp enquiry converted to patient". */
      lead: 'visit.history.rows.lead',
      /** "Patient record created". */
      created: 'visit.history.rows.created',
    },
    note: 'visit.history.note',
    next: 'visit.history.next',
    nextConsult: 'visit.history.nextConsult',
    /** "Laser hair reduction session 4 of 6 →". */
    nextSession: 'visit.history.nextSession',
    nextSessionOpen: 'visit.history.nextSessionOpen',
    /** "Checkout · ₹1,200 due carried →". */
    nextCheckout: 'visit.history.nextCheckout',
    nextCheckoutPlain: 'visit.history.nextCheckoutPlain',
    aside: 'visit.history.aside',
  },
  consult: {
    history: 'visit.consult.history',
    /** "12 Aug · Dr. Mavani". */
    historyEntry: 'visit.consult.historyEntry',
    /** "Laser hair reduction 3". */
    historySession: 'visit.consult.historySession',
    note: 'visit.consult.note',
    complaint: 'visit.consult.complaint',
    findings: 'visit.consult.findings',
    findingsPlaceholder: 'visit.consult.findingsPlaceholder',
    diagnosis: 'visit.consult.diagnosis',
    plan: 'visit.consult.plan',
    rx: 'visit.consult.rx',
    /** "Copy 12 Aug prescription". */
    copyLast: 'visit.consult.copyLast',
    empty: 'visit.consult.empty',
    /** "1-0-1 · qty 1". */
    line: 'visit.consult.line',
    doctorToSet: 'visit.consult.doctorToSet',
    sos: 'visit.consult.sos',
    review: 'visit.consult.review',
    reviewed: 'visit.consult.reviewed',
    remove: 'visit.consult.remove',
    /** "Remove Tretinoin 0.025% cream" — the button's accessible name. */
    removeLine: 'visit.consult.removeLine',
    setDose: 'visit.consult.setDose',
    doses: {
      morning: 'visit.consult.doses.morning',
      afternoon: 'visit.consult.doses.afternoon',
      night: 'visit.consult.doses.night',
    },
    qty: 'visit.consult.qty',
    done: 'visit.consult.done',
    add: 'visit.consult.add',
    /** "+ Tranexamic acid 250 mg". */
    addChip: 'visit.consult.addChip',
    printIn: 'visit.consult.printIn',
    languages: { en: 'visit.consult.languages.en' },
    approve: 'visit.consult.approve',
    /** "Review 2 lines first" (plural). */
    reviewFirst: 'visit.consult.reviewFirst',
    reviewNone: 'visit.consult.reviewNone',
    approving: 'visit.consult.approving',
    /** "Prescription approved for … · moved to checkout". */
    approved: 'visit.consult.approved',
    /** The same, when the visit was already past the doctor. */
    approvedHere: 'visit.consult.approvedHere',
    /** The approved Rx in place of the form ("✓ Rx #502 approved · 3 medicines"). */
    approvedLine: 'visit.consult.approvedLine',
    movedTo: {
      treatment: 'visit.consult.movedTo.treatment',
      checkout: 'visit.consult.movedTo.checkout',
    },
  },
  treatment: {
    /** "Laser hair reduction · Legs". */
    title: 'visit.treatment.title',
    /** "Pack: 10 sessions, bought 28 Aug · 3 used · today is session 4 · valid until 28 Aug 2027". */
    pack: 'visit.treatment.pack',
    instruction: 'visit.treatment.instruction',
    setting: 'visit.treatment.setting',
    /** "Session 3". */
    session: 'visit.treatment.session',
    today: 'visit.treatment.today',
    /** "Power today" — a Today input's accessible name. */
    settingToday: 'visit.treatment.settingToday',
    settings: {
      type: 'visit.treatment.settings.type',
      skinType: 'visit.treatment.settings.skinType',
      machine: 'visit.treatment.settings.machine',
      power: 'visit.treatment.settings.power',
      wavelength: 'visit.treatment.settings.wavelength',
    },
    areas: 'visit.treatment.areas',
    bodyParts: {
      face: 'visit.treatment.bodyParts.face',
      scalp: 'visit.treatment.bodyParts.scalp',
      hair: 'visit.treatment.bodyParts.hair',
      body: 'visit.treatment.bodyParts.body',
      chest: 'visit.treatment.bodyParts.chest',
      back: 'visit.treatment.bodyParts.back',
      underarm: 'visit.treatment.bodyParts.underarm',
      legs: 'visit.treatment.bodyParts.legs',
      arms: 'visit.treatment.bodyParts.arms',
      other: 'visit.treatment.bodyParts.other',
    } satisfies Record<BodyPart, string>,
    /** "Complete session 4 of 6". */
    complete: 'visit.treatment.complete',
    completeOpen: 'visit.treatment.completeOpen',
    completeNote: 'visit.treatment.completeNote',
    recording: 'visit.treatment.recording',
    /** "✓ Session 4 recorded · 2 left · feedback call Tue 29 Sep (Kiran)". */
    recorded: 'visit.treatment.recorded',
    recordedOpen: 'visit.treatment.recordedOpen',
    /** "feedback call Tue 29 Sep (Kiran)" — and without a therapist, the day alone. */
    call: 'visit.treatment.call',
    callDay: 'visit.treatment.callDay',
    reverse: 'visit.treatment.reverse',
    reverseTitle: 'visit.treatment.reverseTitle',
    reversed: 'visit.treatment.reversed',
    /** Toast: "Session 4 of 6 recorded once for Dhruv Patel · 2 left · feedback task for Tue". */
    recordedToast: 'visit.treatment.recordedToast',
    recordedToastOpen: 'visit.treatment.recordedToastOpen',
    photos: 'visit.treatment.photos',
    photosSub: 'visit.treatment.photosSub',
    /** "1 · Baseline · 2 Jul". */
    photo: 'visit.treatment.photo',
    capture: 'visit.treatment.capture',
    captureSub: 'visit.treatment.captureSub',
    upTo: 'visit.treatment.upTo',
    /** "<n> photos uploaded to <first>’s file" (plural). */
    captured: 'visit.treatment.captured',
    photoNote: 'visit.treatment.photoNote',
    consent: {
      marketing: 'visit.treatment.consent.marketing',
      photosOnly: 'visit.treatment.consent.photosOnly',
      none: 'visit.treatment.consent.none',
    },
  },
  checkout: {
    bill: 'visit.checkout.bill',
    billSub: 'visit.checkout.billSub',
    fromPack: 'visit.checkout.fromPack',
    gstExempt: 'visit.checkout.gstExempt',
    /** "Discount 10% → ₹3,150". */
    lineDiscount: 'visit.checkout.lineDiscount',
    subtotal: 'visit.checkout.subtotal',
    discount: 'visit.checkout.discount',
    /** "GST 18% on ₹3,150". */
    gst: 'visit.checkout.gst',
    /** "Previous due · Clinic invoice #781". */
    previousDue: 'visit.checkout.previousDue',
    toPay: 'visit.checkout.toPay',
    serverNote: 'visit.checkout.serverNote',
    nothing: 'visit.checkout.nothing',
    create: 'visit.checkout.create',
    creating: 'visit.checkout.creating',
    /** "✓ #792 finalised. Changes now go through <cancel>Cancel bill</cancel> or <credit>Credit note</credit>." */
    finalised: 'visit.checkout.finalised',
    payment: 'visit.checkout.payment',
    billFirst: 'visit.checkout.billFirst',
    modesLabel: 'visit.checkout.modesLabel',
    split: 'visit.checkout.split',
    splitHint: 'visit.checkout.splitHint',
    amount: 'visit.checkout.amount',
    balance: 'visit.checkout.balance',
    partial: 'visit.checkout.partial',
    /** "Receive ₹3,717 by UPI". */
    receive: 'visit.checkout.receive',
    waiting: 'visit.checkout.waiting',
    receiveNote: 'visit.checkout.receiveNote',
    /** Toast: "₹3,717 received by UPI · PAY-5602 · receipt sent on WhatsApp". */
    received: 'visit.checkout.received',
    nothingDue: 'visit.checkout.nothingDue',
    completeVisit: 'visit.checkout.completeVisit',
    completed: 'visit.checkout.completed',
  },
} as const;

/** The Visit sheet's test ids (`docs/reference/e2e-testids-inventory.md` › Visit sheet). */
export const VISIT_TEST_IDS = {
  page: 'visit-page',
  closeStrip: 'visit-close-strip',
  name: 'visit-name',
  meta: 'visit-meta',
  chip: 'visit-chip',
  fullProfile: 'visit-full-profile',
  close: 'visit-close',
  tab: (tab: VisitTab) => `visit-tab-${tab}`,
  saved: 'visit-saved',
  needsPatient: 'visit-needs-patient',
  history: {
    root: 'visit-history',
    filter: (filter: VisitHistoryFilter) => `visit-history-filter-${filter}`,
    row: 'visit-history-row',
    next: (tab: VisitTab) => `visit-next-${tab}`,
  },
  consult: {
    root: 'visit-consult',
    complaint: 'visit-complaint',
    findings: 'visit-findings',
    diagnosis: 'visit-diagnosis',
    plan: 'visit-plan',
    copyLast: 'visit-copy-rx',
    line: 'visit-rx-line',
    review: 'visit-rx-review',
    remove: 'visit-rx-remove',
    dose: 'visit-rx-dose',
    add: 'visit-rx-add',
    approve: 'visit-approve',
    approved: 'visit-rx-approved',
  },
  treatment: {
    root: 'visit-treatment',
    setting: (key: string) => `visit-setting-${key}`,
    area: 'visit-area',
    complete: 'visit-complete-session',
    recorded: 'visit-session-recorded',
    reverse: 'visit-reverse-session',
    photo: 'visit-photo',
    capture: 'visit-capture',
  },
  checkout: {
    root: 'visit-checkout',
    line: 'visit-bill-line',
    create: 'visit-create-bill',
    made: 'visit-bill-made',
    mode: (mode: string) => `visit-mode-${mode}`,
    amount: 'visit-amount',
    receive: 'visit-receive',
    complete: 'visit-complete',
  },
} as const;
