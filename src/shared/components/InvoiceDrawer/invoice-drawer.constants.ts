import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { InvoiceType, Tone } from '@/shared/api/clinic/clinic-schema.ts';

/**
 * The Invoice drawer's copy lives in `clinic`, not the room's `payments`: the
 * drawer is shared — the `invoices/` routes open it over Payments, the patient
 * file and Medical's New sale (KICKOFF §6.9) — and `clinic` loads with the org
 * shell wherever it renders.
 */
export const INVOICE_DRAWER_NS = I18N_NAMESPACES.clinic;

/** Key paths for the Invoice drawer and the preview (`payments.md` › Copy, verbatim). */
export const INVOICE_DRAWER_KEYS = {
  title: {
    create: 'invoiceDrawer.title.create',
    edit: 'invoiceDrawer.title.edit',
    createSale: 'invoiceDrawer.title.createSale',
    editSale: 'invoiceDrawer.title.editSale',
  },
  sub: {
    create: 'invoiceDrawer.sub.create',
    edit: 'invoiceDrawer.sub.edit',
    sale: 'invoiceDrawer.sub.sale',
  },
  /** The type switch's accessible name. */
  type: 'invoiceDrawer.type',
  steps: {
    party: 'invoiceDrawer.steps.party',
    items: 'invoiceDrawer.steps.items',
    medicines: 'invoiceDrawer.steps.medicines',
    payment: 'invoiceDrawer.steps.payment',
  },
  fields: {
    branch: 'invoiceDrawer.fields.branch',
    newPatient: 'invoiceDrawer.fields.newPatient',
    customer: 'invoiceDrawer.fields.customer',
    customerHint: 'invoiceDrawer.fields.customerHint',
    customerPlaceholder: 'invoiceDrawer.fields.customerPlaceholder',
    addContact: 'invoiceDrawer.fields.addContact',
    mobile: 'invoiceDrawer.fields.mobile',
    mobileHint: 'invoiceDrawer.fields.mobileHint',
    mobilePlaceholder: 'invoiceDrawer.fields.mobilePlaceholder',
    team: 'invoiceDrawer.fields.team',
    prescribedBy: 'invoiceDrawer.fields.prescribedBy',
    teamPlaceholder: 'invoiceDrawer.fields.teamPlaceholder',
    teamHint: 'invoiceDrawer.fields.teamHint',
    teamFrom: 'invoiceDrawer.fields.teamFrom',
    overallDiscount: 'invoiceDrawer.fields.overallDiscount',
    quickFill: 'invoiceDrawer.fields.quickFill',
    paidNow: 'invoiceDrawer.fields.paidNow',
    /** A saved invoice's money so far — its receipts are the ledger's (Receive payment). */
    paid: 'invoiceDrawer.fields.paid',
    remark: 'invoiceDrawer.fields.remark',
    remarkPlaceholder: 'invoiceDrawer.fields.remarkPlaceholder',
  },
  /** The customer list's groups (`payments.md:138`). */
  customerGroups: {
    patient: 'invoiceDrawer.customerGroups.patient',
    lead: 'invoiceDrawer.customerGroups.lead',
    contact: 'invoiceDrawer.customerGroups.contact',
  },
  customerSub: {
    noMobile: 'invoiceDrawer.customerSub.noMobile',
  },
  items: {
    quickLine: 'invoiceDrawer.items.quickLine',
    quickLineMedical: 'invoiceDrawer.items.quickLineMedical',
    hint: 'invoiceDrawer.items.hint',
    /** An invoice's quick line takes a quantity and a discount — the server prices the line. */
    hintInvoice: 'invoiceDrawer.items.hintInvoice',
    oftenBilled: 'invoiceDrawer.items.oftenBilled',
    browse: {
      all: 'invoiceDrawer.items.browse.all',
      oral: 'invoiceDrawer.items.browse.oral',
      topical: 'invoiceDrawer.items.browse.topical',
    },
    columns: {
      offering: 'invoiceDrawer.items.columns.offering',
      medicine: 'invoiceDrawer.items.columns.medicine',
      qty: 'invoiceDrawer.items.columns.qty',
      rate: 'invoiceDrawer.items.columns.rate',
      discount: 'invoiceDrawer.items.columns.discount',
      gst: 'invoiceDrawer.items.columns.gst',
      final: 'invoiceDrawer.items.columns.final',
    },
    pickItem: 'invoiceDrawer.items.pickItem',
    selectOffering: 'invoiceDrawer.items.selectOffering',
    selectMedicine: 'invoiceDrawer.items.selectMedicine',
    newOffering: 'invoiceDrawer.items.newOffering',
    addItem: 'invoiceDrawer.items.addItem',
    addMedicine: 'invoiceDrawer.items.addMedicine',
    total: 'invoiceDrawer.items.total',
    sessions: 'invoiceDrawer.items.sessions',
    inStock: 'invoiceDrawer.items.inStock',
    outOfStock: 'invoiceDrawer.items.outOfStock',
    /** The Final cell's tooltip under the lowest price, for a member who sees it (H:5059). */
    belowFloor: 'invoiceDrawer.items.belowFloor',
    /** The same, for a member who may not see the lowest price (`offering:lower_price:read`). */
    belowLowest: 'invoiceDrawer.items.belowLowest',
    /** The Rate cell's spoken words for the live offer that priced the line. */
    offerApplied: 'invoiceDrawer.items.offerApplied',
    /** Browse's inline field for a medicine the store lacks (`medical.md:413`, Q-M4). */
    newMedicineName: 'invoiceDrawer.items.newMedicineName',
    /** "Azel Cream added · set MRP later in Stock" — the quick draft's toast. */
    medicineAdded: 'invoiceDrawer.items.medicineAdded',
  },
  payment: {
    full: 'invoiceDrawer.payment.full',
    split: 'invoiceDrawer.payment.split',
    nothing: 'invoiceDrawer.payment.nothing',
    mode: 'invoiceDrawer.payment.mode',
    amount: 'invoiceDrawer.payment.amount',
    addMode: 'invoiceDrawer.payment.addMode',
    paidTotal: 'invoiceDrawer.payment.paidTotal',
  },
  totals: {
    label: 'invoiceDrawer.totals.label',
    /** The preview's caption: the figures are the server's, as the save will write them. */
    preview: 'invoiceDrawer.totals.preview',
    pending: 'invoiceDrawer.totals.pending',
    refused: 'invoiceDrawer.totals.refused',
    failed: 'invoiceDrawer.totals.failed',
    retry: 'invoiceDrawer.totals.retry',
    subtotal: 'invoiceDrawer.totals.subtotal',
    discountGst: 'invoiceDrawer.totals.discountGst',
    discountGstValue: 'invoiceDrawer.totals.discountGstValue',
    bill: 'invoiceDrawer.totals.bill',
    dueAfter: 'invoiceDrawer.totals.dueAfter',
  },
  badges: {
    bill: 'invoiceDrawer.badges.bill',
    sessions: 'invoiceDrawer.badges.sessions',
    draft: 'invoiceDrawer.badges.draft',
    due: 'invoiceDrawer.badges.due',
    paid: 'invoiceDrawer.badges.paid',
  },
  presets: {
    print: 'invoiceDrawer.presets.print',
    plan: 'invoiceDrawer.presets.plan',
    planQty: 'invoiceDrawer.presets.planQty',
    package: 'invoiceDrawer.presets.package',
    repeat: 'invoiceDrawer.presets.repeat',
    consultation: 'invoiceDrawer.presets.consultation',
    rx: 'invoiceDrawer.presets.rx',
  },
  save: {
    clinic: 'invoiceDrawer.save.clinic',
    medical: 'invoiceDrawer.save.medical',
    consultation: 'invoiceDrawer.save.consultation',
    edit: 'invoiceDrawer.save.edit',
  },
  summary: 'invoiceDrawer.summary',
  summaryItems: 'invoiceDrawer.summaryItems',
  noPatient: 'invoiceDrawer.noPatient',
  errors: {
    pickPatient: 'invoiceDrawer.errors.pickPatient',
    pickCustomer: 'invoiceDrawer.errors.pickCustomer',
    addItem: 'invoiceDrawer.errors.addItem',
    paidAboveBill: 'invoiceDrawer.errors.paidAboveBill',
    stock: 'invoiceDrawer.errors.stock',
    belowFloor: 'invoiceDrawer.errors.belowFloor',
    belowLowest: 'invoiceDrawer.errors.belowLowest',
  },
  /** Why clinozy-be refused a save or a delete — each in the screen's words. */
  refusals: {
    moreThanDue: 'invoiceDrawer.refusals.moreThanDue',
    dayClosed: 'invoiceDrawer.refusals.dayClosed',
    settled: 'invoiceDrawer.refusals.settled',
    belowPaid: 'invoiceDrawer.refusals.belowPaid',
    offeringInUse: 'invoiceDrawer.refusals.offeringInUse',
    treatmentBilled: 'invoiceDrawer.refusals.treatmentBilled',
    ofSale: 'invoiceDrawer.refusals.ofSale',
    paid: 'invoiceDrawer.refusals.paid',
    inUseDelete: 'invoiceDrawer.refusals.inUseDelete',
  },
  /** Why a saved invoice opens read-only: its day closed, or a Medical sale's. */
  notices: {
    settled: 'invoiceDrawer.notices.settled',
    sale: 'invoiceDrawer.notices.sale',
  },
  toasts: {
    /** "Clinic invoice #788 created" — one sentence per type, for the translations. */
    created: {
      clinic: 'invoiceDrawer.toasts.created.clinic',
      medical: 'invoiceDrawer.toasts.created.medical',
      consultation: 'invoiceDrawer.toasts.created.consultation',
    },
    /** A copy's create — the patient file's "Copy invoice" (H:5017): "Copied as #788". */
    copied: 'invoiceDrawer.toasts.copied',
    /** "<created> · 2 offering suggestions items marked invoiced". */
    createdPlan: 'invoiceDrawer.toasts.createdPlan',
    saved: 'invoiceDrawer.toasts.saved',
    savedPlan: 'invoiceDrawer.toasts.savedPlan',
    promo: 'invoiceDrawer.toasts.promo',
    contactSaved: 'invoiceDrawer.toasts.contactSaved',
    rxUnmatched: 'invoiceDrawer.toasts.rxUnmatched',
    deleted: 'invoiceDrawer.toasts.deleted',
  },
  deleteTitle: 'invoiceDrawer.deleteTitle',
  /** The preview's title (H:3637 `pyDoc`): "Invoice #787", "Medical invoice #785". */
  previewTitle: {
    clinic: 'invoiceDrawer.previewTitle.clinic',
    medical: 'invoiceDrawer.previewTitle.medical',
    consultation: 'invoiceDrawer.previewTitle.consultation',
  },
  /** The record a not-found dialog route names ("Invoice not found · it may have been deleted"). */
  record: 'invoiceDrawer.record',
} as const;

/** The drawer's root test id; its parts derive theirs (`invoice-drawer-save` …). */
export const INVOICE_DRAWER_TEST_ID = 'invoice-drawer';

/** The `data-testid`s of the drawer's own parts, from its root id. */
export const INVOICE_DRAWER_TEST_IDS = {
  typeSwitch: `${INVOICE_DRAWER_TEST_ID}-type`,
  branch: `${INVOICE_DRAWER_TEST_ID}-branch`,
  patient: `${INVOICE_DRAWER_TEST_ID}-patient`,
  customer: `${INVOICE_DRAWER_TEST_ID}-customer`,
  mobile: `${INVOICE_DRAWER_TEST_ID}-mobile`,
  team: `${INVOICE_DRAWER_TEST_ID}-team`,
  quickLine: `${INVOICE_DRAWER_TEST_ID}-quick-line`,
  items: `${INVOICE_DRAWER_TEST_ID}-items`,
  overallDiscount: `${INVOICE_DRAWER_TEST_ID}-overall-discount`,
  paymentQuickFill: `${INVOICE_DRAWER_TEST_ID}-payment-fill`,
  paidNow: `${INVOICE_DRAWER_TEST_ID}-paid-now`,
  remark: `${INVOICE_DRAWER_TEST_ID}-remark`,
  totals: `${INVOICE_DRAWER_TEST_ID}-totals`,
  notice: `${INVOICE_DRAWER_TEST_ID}-notice`,
  preview: 'invoice-preview',
} as const;

/** Each type's tone — the switch's dot, the type badge (`payments.md:134`). */
export const INVOICE_TYPE_TONES: Readonly<Record<InvoiceType, Tone>> = {
  clinic: 'sky',
  medical: 'sage',
  consultation: 'lav',
};

/** The types in the switch's order (`payments.md:134`). */
export const INVOICE_TYPE_ORDER: readonly InvoiceType[] = [
  'clinic',
  'medical',
  'consultation',
];

/** The Payments section's tone — the open step's circle (`payments.md:11`). */
export const INVOICE_DRAWER_TONE: Tone = 'peach';
