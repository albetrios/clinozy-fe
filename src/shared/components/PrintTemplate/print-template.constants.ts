import type { I18nLocale } from '@/lib/i18n/locales.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { InvoiceStatus } from '@/shared/api/app/app-money.ts';
import type {
  BodyPart,
  OfferingSpecialty,
  PoStage,
  RxMeal,
  RxTiming,
} from '@/shared/api/app/app-schema.ts';

/**
 * Print template copy has its own namespace, `print`: loaded on demand by
 * `printDocument` (in the print language, whatever the screen's), so the
 * sheets' words never ride the entry bundle.
 */
export const PRINT_TEMPLATE_NS = I18N_NAMESPACES.print;

/**
 * The language a sheet prints in. Prints and patient messages are English at
 * launch (Q-X2) — not the screen's language: a patient reads the prescription,
 * and Gujarati and Hindi templates come later, with native review.
 */
export const PRINT_LANGUAGE: I18nLocale = 'en';

/** The print dialog opens this long after the sheet renders (H:4423, H:4425). */
export const PRINT_OPEN_DELAY_MS = 260;

/** Key paths in the `print` namespace (copy verbatim from H:434–514). */
export const PRINT_TEMPLATE_KEYS = {
  patientInformation: 'patientInformation',
  name: 'name',
  contact: 'contact',
  gstin: 'gstin',
  /** "Thank you for choosing <clinic> for your … needs" — by the clinic's specialty. */
  thanks: {
    skin: 'thanks.skin',
    hair: 'thanks.hair',
    dental: 'thanks.dental',
    gynac: 'thanks.gynac',
    physio: 'thanks.physio',
    general: 'thanks.general',
  } satisfies Record<OfferingSpecialty, string>,
  /** The Medical sheet thanks for "medicine needs" whatever the specialty. */
  thanksMedicine: 'thanksMedicine',
  invoice: {
    customerInformation: 'invoice.customerInformation',
    invoiceDetails: 'invoice.invoiceDetails',
    saleDetails: 'invoice.saleDetails',
    phone: 'invoice.phone',
    invoiceDate: 'invoice.invoiceDate',
    saleDate: 'invoice.saleDate',
    invoiceNumber: 'invoice.invoiceNumber',
    saleNumber: 'invoice.saleNumber',
    status: 'invoice.status',
    statuses: {
      paid: 'invoice.statuses.paid',
      partial: 'invoice.statuses.partial',
      unpaid: 'invoice.statuses.unpaid',
    } satisfies Record<InvoiceStatus, string>,
    items: 'invoice.items',
    medicineItems: 'invoice.medicineItems',
    item: 'invoice.item',
    medicineName: 'invoice.medicineName',
    packSize: 'invoice.packSize',
    qty: 'invoice.qty',
    amount: 'invoice.amount',
    discount: 'invoice.discount',
    gst: 'invoice.gst',
    netAmount: 'invoice.netAmount',
    notes: 'invoice.notes',
    noNotes: 'invoice.noNotes',
    paymentSummary: 'invoice.paymentSummary',
    totalAmount: 'invoice.totalAmount',
    taxableAmount: 'invoice.taxableAmount',
    gstTotal: 'invoice.gstTotal',
    billAmount: 'invoice.billAmount',
    balanceDue: 'invoice.balanceDue',
  },
  prescription: {
    patientId: 'prescription.patientId',
    age: 'prescription.age',
    years: 'prescription.years',
    details: 'prescription.details',
    date: 'prescription.date',
    number: 'prescription.number',
    doctor: 'prescription.doctor',
    medicines: 'prescription.medicines',
    medicine: 'prescription.medicine',
    dosage: 'prescription.dosage',
    when: 'prescription.when',
    where: 'prescription.where',
    qty: 'prescription.qty',
    remark: 'prescription.remark',
    sos: 'prescription.sos',
    labReports: 'prescription.labReports',
    noLabReports: 'prescription.noLabReports',
    procedures: 'prescription.procedures',
    noProcedures: 'prescription.noProcedures',
    advice: 'prescription.advice',
    noAdvice: 'prescription.noAdvice',
    followUp: 'prescription.followUp',
    followUpDate: 'prescription.followUpDate',
    notScheduled: 'prescription.notScheduled',
    signature: 'prescription.signature',
    signHere: 'prescription.signHere',
    meal: {
      before: 'prescription.meal.before',
      after: 'prescription.meal.after',
    } satisfies Record<RxMeal, string>,
    timing: {
      empty_stomach: 'prescription.timing.empty_stomach',
      with_meal: 'prescription.timing.with_meal',
      morning: 'prescription.timing.morning',
      night: 'prescription.timing.night',
      morning_night: 'prescription.timing.morning_night',
      thrice_week: 'prescription.timing.thrice_week',
      once_week: 'prescription.timing.once_week',
      alternate_days: 'prescription.timing.alternate_days',
    } satisfies Record<RxTiming, string>,
    /** `other` prints the line's own `bodyPartText`. */
    bodyPart: {
      face: 'prescription.bodyPart.face',
      scalp: 'prescription.bodyPart.scalp',
      hair: 'prescription.bodyPart.hair',
      body: 'prescription.bodyPart.body',
      chest: 'prescription.bodyPart.chest',
      back: 'prescription.bodyPart.back',
      underarm: 'prescription.bodyPart.underarm',
      legs: 'prescription.bodyPart.legs',
      arms: 'prescription.bodyPart.arms',
    } satisfies Record<Exclude<BodyPart, 'other'>, string>,
  },
  /**
   * The purchase order sheet (Q-M7) — no design draws it: the invoice sheet's
   * anatomy, its items, notes and summary words reused from `invoice`.
   */
  purchaseOrder: {
    supplierInformation: 'purchaseOrder.supplierInformation',
    orderDetails: 'purchaseOrder.orderDetails',
    orderDate: 'purchaseOrder.orderDate',
    /** "Purchase Order:" over "PO #431". */
    orderNumber: 'purchaseOrder.orderNumber',
    /** The supplier's own bill number — the drawer's "Invoice no.". */
    invoiceNumber: 'purchaseOrder.invoiceNumber',
    gstin: 'purchaseOrder.gstin',
    stages: {
      ordered: 'purchaseOrder.stages.ordered',
      received: 'purchaseOrder.stages.received',
      paid: 'purchaseOrder.stages.paid',
      cancelled: 'purchaseOrder.stages.cancelled',
    } satisfies Record<PoStage, string>,
    batch: 'purchaseOrder.batch',
    expiry: 'purchaseOrder.expiry',
    free: 'purchaseOrder.free',
    rate: 'purchaseOrder.rate',
    paid: 'purchaseOrder.paid',
    /** The footer's first line: the clinic the order is from. */
    issuedBy: 'purchaseOrder.issuedBy',
  },
} as const;

/** Test ids of the print host and the sheets (`docs/reference/e2e-testids-inventory.md`). */
export const PRINT_TEMPLATE_TEST_IDS = {
  root: 'print-root',
  invoice: 'invoice-print',
  invoiceItems: 'invoice-print-items',
  invoiceSummary: 'invoice-print-summary',
  prescription: 'prescription-print',
  prescriptionItems: 'prescription-print-items',
  purchaseOrder: 'purchase-order-print',
  purchaseOrderItems: 'purchase-order-print-items',
  purchaseOrderSummary: 'purchase-order-print-summary',
  footer: 'print-footer',
} as const;
