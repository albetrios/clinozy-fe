import type { I18nLocale } from '@/lib/i18n/locales.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { InvoiceStatus } from '@/shared/api/clinic/clinic-money.ts';
import type {
  BodyPart,
  OfferingSpecialty,
  RxMeal,
  RxTiming,
} from '@/shared/api/clinic/clinic-schema.ts';

/**
 * Print template copy lives in `common`: its English bundle ships with the
 * entry, so a sheet always has its words — whatever language the screen is in.
 */
export const PRINT_TEMPLATE_NS = I18N_NAMESPACES.common;

/**
 * The language a sheet prints in. Prints and patient messages are English at
 * launch (Q-X2) — not the screen's language: a patient reads the prescription,
 * and Gujarati and Hindi templates come later, with native review.
 */
export const PRINT_LANGUAGE: I18nLocale = 'en';

/** The print dialog opens this long after the sheet renders (H:4423, H:4425). */
export const PRINT_OPEN_DELAY_MS = 260;

/** Key paths of the `printTemplate` object in `common` (copy verbatim from H:434–514). */
export const PRINT_TEMPLATE_KEYS = {
  patientInformation: 'printTemplate.patientInformation',
  name: 'printTemplate.name',
  contact: 'printTemplate.contact',
  gstin: 'printTemplate.gstin',
  /** "Thank you for choosing <clinic> for your … needs" — by the clinic's specialty. */
  thanks: {
    skin: 'printTemplate.thanks.skin',
    hair: 'printTemplate.thanks.hair',
    dental: 'printTemplate.thanks.dental',
    gynac: 'printTemplate.thanks.gynac',
    physio: 'printTemplate.thanks.physio',
    general: 'printTemplate.thanks.general',
  } satisfies Record<OfferingSpecialty, string>,
  /** The Medical sheet thanks for "medicine needs" whatever the specialty. */
  thanksMedicine: 'printTemplate.thanksMedicine',
  invoice: {
    customerInformation: 'printTemplate.invoice.customerInformation',
    invoiceDetails: 'printTemplate.invoice.invoiceDetails',
    saleDetails: 'printTemplate.invoice.saleDetails',
    phone: 'printTemplate.invoice.phone',
    invoiceDate: 'printTemplate.invoice.invoiceDate',
    saleDate: 'printTemplate.invoice.saleDate',
    invoiceNumber: 'printTemplate.invoice.invoiceNumber',
    saleNumber: 'printTemplate.invoice.saleNumber',
    status: 'printTemplate.invoice.status',
    statuses: {
      paid: 'printTemplate.invoice.statuses.paid',
      partial: 'printTemplate.invoice.statuses.partial',
      unpaid: 'printTemplate.invoice.statuses.unpaid',
    } satisfies Record<InvoiceStatus, string>,
    items: 'printTemplate.invoice.items',
    medicineItems: 'printTemplate.invoice.medicineItems',
    item: 'printTemplate.invoice.item',
    medicineName: 'printTemplate.invoice.medicineName',
    packSize: 'printTemplate.invoice.packSize',
    qty: 'printTemplate.invoice.qty',
    amount: 'printTemplate.invoice.amount',
    discount: 'printTemplate.invoice.discount',
    gst: 'printTemplate.invoice.gst',
    netAmount: 'printTemplate.invoice.netAmount',
    notes: 'printTemplate.invoice.notes',
    noNotes: 'printTemplate.invoice.noNotes',
    paymentSummary: 'printTemplate.invoice.paymentSummary',
    totalAmount: 'printTemplate.invoice.totalAmount',
    overallDiscount: 'printTemplate.invoice.overallDiscount',
    billAmount: 'printTemplate.invoice.billAmount',
    balanceDue: 'printTemplate.invoice.balanceDue',
  },
  prescription: {
    patientId: 'printTemplate.prescription.patientId',
    age: 'printTemplate.prescription.age',
    years: 'printTemplate.prescription.years',
    details: 'printTemplate.prescription.details',
    date: 'printTemplate.prescription.date',
    number: 'printTemplate.prescription.number',
    doctor: 'printTemplate.prescription.doctor',
    medicines: 'printTemplate.prescription.medicines',
    medicine: 'printTemplate.prescription.medicine',
    dosage: 'printTemplate.prescription.dosage',
    when: 'printTemplate.prescription.when',
    where: 'printTemplate.prescription.where',
    qty: 'printTemplate.prescription.qty',
    remark: 'printTemplate.prescription.remark',
    sos: 'printTemplate.prescription.sos',
    labReports: 'printTemplate.prescription.labReports',
    noLabReports: 'printTemplate.prescription.noLabReports',
    procedures: 'printTemplate.prescription.procedures',
    noProcedures: 'printTemplate.prescription.noProcedures',
    advice: 'printTemplate.prescription.advice',
    noAdvice: 'printTemplate.prescription.noAdvice',
    followUp: 'printTemplate.prescription.followUp',
    followUpDate: 'printTemplate.prescription.followUpDate',
    notScheduled: 'printTemplate.prescription.notScheduled',
    signature: 'printTemplate.prescription.signature',
    signHere: 'printTemplate.prescription.signHere',
    meal: {
      before: 'printTemplate.prescription.meal.before',
      after: 'printTemplate.prescription.meal.after',
    } satisfies Record<RxMeal, string>,
    timing: {
      empty_stomach: 'printTemplate.prescription.timing.empty_stomach',
      with_meal: 'printTemplate.prescription.timing.with_meal',
      morning: 'printTemplate.prescription.timing.morning',
      night: 'printTemplate.prescription.timing.night',
      morning_night: 'printTemplate.prescription.timing.morning_night',
      thrice_week: 'printTemplate.prescription.timing.thrice_week',
      once_week: 'printTemplate.prescription.timing.once_week',
      alternate_days: 'printTemplate.prescription.timing.alternate_days',
    } satisfies Record<RxTiming, string>,
    /** `other` prints the line's own `bodyPartText`. */
    bodyPart: {
      face: 'printTemplate.prescription.bodyPart.face',
      scalp: 'printTemplate.prescription.bodyPart.scalp',
      hair: 'printTemplate.prescription.bodyPart.hair',
      body: 'printTemplate.prescription.bodyPart.body',
      chest: 'printTemplate.prescription.bodyPart.chest',
      back: 'printTemplate.prescription.bodyPart.back',
      underarm: 'printTemplate.prescription.bodyPart.underarm',
      legs: 'printTemplate.prescription.bodyPart.legs',
      arms: 'printTemplate.prescription.bodyPart.arms',
    } satisfies Record<Exclude<BodyPart, 'other'>, string>,
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
  footer: 'print-footer',
} as const;
