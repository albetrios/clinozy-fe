import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The section tables read the patient file's namespace. */
export const PATIENT_TABLE_NS = I18N_NAMESPACES.patientFile;

/** The sections that are tables (KICKOFF §6.6 Section tables). */
export type PatientTableSection =
  'visits' | 'prescriptions' | 'treatments' | 'reports' | 'invoices' | 'payments';

/** One table's own words: its records, its count, its empty state. */
const tableKeys = (section: PatientTableSection) =>
  ({
    /** "All appointments loaded" / "Loading more appointments". */
    records: `tables.${section}.records`,
    /** "3 appointments" (plural). */
    count: `tables.${section}.count`,
    empty: `tables.${section}.empty`,
  }) as const;

/** The section tables' copy (H:4746–4760; `patient-file.md:34–46`), verbatim. */
export const PATIENT_TABLE_KEYS = {
  export: 'tables.export',
  /** "3 rows exported as CSV" (plural). */
  exported: 'tables.exported',
  visits: tableKeys('visits'),
  prescriptions: {
    ...tableKeys('prescriptions'),
    copied: 'tables.prescriptions.copied',
  },
  treatments: {
    ...tableKeys('treatments'),
    /** "Session 2 added". */
    copied: 'tables.treatments.copied',
    /** "Better · 7/10". */
    feedbackScore: 'tables.treatments.feedbackScore',
    /** The feedback pill's tooltip: "Check-in 26 Sep". */
    checkInOn: 'tables.treatments.checkInOn',
    callNextDay: 'tables.treatments.callNextDay',
    /** "Call in 2 days" (plural). */
    callInDays: 'tables.treatments.callInDays',
  },
  reports: {
    ...tableKeys('reports'),
    /** "PDF · shared with patient on request". */
    fileSub: 'tables.reports.fileSub',
    deleteTitle: 'tables.reports.deleteTitle',
    deleted: 'tables.reports.deleted',
  },
  invoices: {
    ...tableKeys('invoices'),
    /** "2 invoices · ₹1,500 due" (plural). */
    countDue: 'tables.invoices.countDue',
    /** "2 items" (plural). */
    itemCount: 'tables.invoices.itemCount',
    due: 'tables.invoices.due',
    nothingDue: 'tables.invoices.nothingDue',
  },
  payments: {
    ...tableKeys('payments'),
    /** "+ ₹2,000" — a receipt, in the sage ink. */
    received: 'tables.payments.received',
    /** "− ₹500" — a refund, in the blush ink. */
    paid: 'tables.payments.paid',
  },
  columns: {
    id: 'tables.columns.id',
    when: 'tables.columns.when',
    offering: 'tables.columns.offering',
    doctor: 'tables.columns.doctor',
    status: 'tables.columns.status',
    date: 'tables.columns.date',
    medicines: 'tables.columns.medicines',
    notes: 'tables.columns.notes',
    updated: 'tables.columns.updated',
    treatment: 'tables.columns.treatment',
    area: 'tables.columns.area',
    team: 'tables.columns.team',
    session: 'tables.columns.session',
    details: 'tables.columns.details',
    feedback: 'tables.columns.feedback',
    report: 'tables.columns.report',
    type: 'tables.columns.type',
    invoice: 'tables.columns.invoice',
    items: 'tables.columns.items',
    bill: 'tables.columns.bill',
    paid: 'tables.columns.paid',
    receipt: 'tables.columns.receipt',
    mode: 'tables.columns.mode',
    amount: 'tables.columns.amount',
    by: 'tables.columns.by',
  },
  actions: {
    print: 'tables.actions.print',
    preview: 'tables.actions.preview',
    copyRx: 'tables.actions.copyRx',
    sell: 'tables.actions.sell',
    /** "Copy invoice" — the Invoice drawer prefilled from the invoice. */
    copyInvoice: 'tables.actions.copyInvoice',
    checkIn: 'tables.actions.checkIn',
    copyTreatment: 'tables.actions.copyTreatment',
    open: 'tables.actions.open',
    pay: 'tables.actions.pay',
    edit: 'tables.actions.edit',
    delete: 'tables.actions.delete',
  },
} as const;

/** Each table's id — its test ids (`<id>-table…`) and its Columns choice (device prefs). */
export const PATIENT_SECTION_TABLE_IDS: Readonly<Record<PatientTableSection, string>> = {
  visits: 'patient-visits',
  prescriptions: 'patient-prescriptions',
  treatments: 'patient-treatments',
  reports: 'patient-reports',
  invoices: 'patient-invoices',
  payments: 'patient-payments',
};
