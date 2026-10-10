import type { AppointmentRecord } from '@/shared/api/clinic/appointments-fixture-contracts.ts';
import { createFixtureCollection } from '@/shared/api/clinic/clinic-fixture-store.ts';
import type {
  Branch,
  CheckIn,
  CreditNote,
  FeedbackAction,
  Invoice,
  LeadMessage,
  Manufacturer,
  MedicalContact,
  MedicalPurchaseOrder,
  MedicalRep,
  MedicalSale,
  MRVisit,
  OfferingSuggestion,
  Organization,
  PatientImage,
  PatientNote,
  PatientPackage,
  PatientReport,
  Prescription,
  Review,
  StockCount,
  StockItem,
  StockMovement,
  StockPurchase,
  StockVendor,
  Supplier,
  Treatment,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-fixture-contracts.ts';
import type { MedicineRecord } from '@/shared/api/clinic/medicines-contracts.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-fixture-contracts.ts';
import type { PatientRecord } from '@/shared/api/clinic/patients-fixture-contracts.ts';
import type {
  DayCloseRecord,
  PaymentRecord,
  PendingCreditRecord,
} from '@/shared/api/clinic/payments-fixture-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/staff-fixture-contracts.ts';
import type { TaskRecord } from '@/shared/api/clinic/tasks-fixture-contracts.ts';

import { appointmentSeed } from './appointments.fixtures.ts';
import { leadMessageSeed, leadSeed } from './leads.fixtures.ts';
import {
  manufacturerSeed,
  medicalContactSeed,
  medicalRepSeed,
  medicalSaleSeed,
  medicineSeed,
  mrVisitSeed,
  purchaseOrderSeed,
  supplierSeed,
} from './medical.fixtures.ts';
import {
  creditNoteSeed,
  dayCloseSeed,
  invoiceSeed,
  paymentSeed,
  pendingCreditSeed,
} from './money.fixtures.ts';
import { offeringSeed, offerSeed } from './offerings.fixtures.ts';
import { branchSeed, organizationSeed } from './organization.fixtures.ts';
import {
  checkInSeed,
  feedbackActionSeed,
  offeringSuggestionSeed,
  patientImageSeed,
  patientNoteSeed,
  patientPackageSeed,
  patientReportSeed,
  prescriptionSeed,
  reviewSeed,
  treatmentSeed,
} from './patient-records.fixtures.ts';
import { patientSeed } from './patients.fixtures.ts';
import { staffSeed } from './staff.fixtures.ts';
import {
  stockCountSeed,
  stockItemSeed,
  stockMovementSeed,
  stockPurchaseSeed,
  stockVendorSeed,
} from './stock.fixtures.ts';
import { taskSeed } from './tasks.fixtures.ts';

/**
 * The clinic fixture world (D6, D37 — REPLACE_WITH_API): one in-memory
 * collection per contract entity, seeded from the prototype the first time a
 * room reads it, on the real clinic clock — the prototype's seed day is today.
 * The records cross-link by id like one database. Room api modules read and
 * write these; when an entity's API lands its collection is deleted.
 */
export const clinicFixtures = {
  branches: createFixtureCollection<Branch>({
    resource: 'Branch',
    seed: () => branchSeed(),
  }),
  // A fixture staff member and the membership it stands for — see staff-fixture-contracts.ts.
  staff: createFixtureCollection<StaffProfile>({
    resource: 'User',
    seed: () => staffSeed(),
  }),
  // Patients carry the plan's consent set, "Referred by" and last editor — see patients-fixture-contracts.ts.
  patients: createFixtureCollection<PatientRecord>({
    resource: 'Patient',
    seed: () => patientSeed(),
  }),
  // Leads carry the plan's hold, unread and custom-interest fields — see leads-contracts.ts.
  leads: createFixtureCollection<LeadRecord>({
    resource: 'Lead',
    seed: () => leadSeed(),
  }),
  // A chat line has no display id (`S:268–286`), so a send gets no `seq`.
  leadMessages: createFixtureCollection<LeadMessage>({
    resource: 'Message',
    seed: () => leadMessageSeed(),
    sequenced: false,
  }),
  // The appointments carry the plan's fields (Appendix F) — see appointments-fixture-contracts.ts.
  appointments: createFixtureCollection<AppointmentRecord>({
    resource: 'Appointment',
    seed: () => appointmentSeed(),
  }),
  prescriptions: createFixtureCollection<Prescription>({
    resource: 'Prescription',
    seed: () => prescriptionSeed(),
  }),
  treatments: createFixtureCollection<Treatment>({
    resource: 'Treatment',
    seed: () => treatmentSeed(),
  }),
  patientImages: createFixtureCollection<PatientImage>({
    resource: 'Photo',
    seed: () => patientImageSeed(),
  }),
  patientReports: createFixtureCollection<PatientReport>({
    resource: 'Report',
    seed: () => patientReportSeed(),
  }),
  // A package may be added before its invoice (A-F6): the rooms still on fixtures hold
  // `invoiceId` nullable; the patient file reads clinozy-be's packages.
  patientPackages: createFixtureCollection<
    Omit<PatientPackage, 'invoiceId'> & { invoiceId: string | null }
  >({
    resource: 'Package',
    seed: () => patientPackageSeed(),
  }),
  patientNotes: createFixtureCollection<PatientNote>({
    resource: 'Note',
    seed: () => patientNoteSeed(),
  }),
  offeringSuggestions: createFixtureCollection<OfferingSuggestion>({
    resource: 'Offering suggestion',
    seed: () => offeringSuggestionSeed(),
  }),
  checkIns: createFixtureCollection<CheckIn>({
    resource: 'Check-in',
    seed: () => checkInSeed(),
  }),
  reviews: createFixtureCollection<Review>({
    resource: 'Review',
    seed: () => reviewSeed(),
  }),
  feedbackActions: createFixtureCollection<FeedbackAction>({
    resource: 'Feedback action',
    seed: () => feedbackActionSeed(),
    sequenced: false,
  }),
  // The offerings domain carries the plan's fields (offerings-fixture-contracts.ts).
  offerings: createFixtureCollection<OfferingRecord>({
    resource: 'Offering',
    seed: () => offeringSeed(),
  }),
  offers: createFixtureCollection<OfferRecord>({
    resource: 'Offer',
    seed: () => offerSeed(),
    sequenced: false,
  }),
  invoices: createFixtureCollection<Invoice>({
    resource: 'Invoice',
    seed: () => invoiceSeed(),
  }),
  // Entries carry the plan's reference, edit log and bill photos — see payments-fixture-contracts.ts.
  payments: createFixtureCollection<PaymentRecord>({
    resource: 'Payment',
    seed: () => paymentSeed(),
  }),
  creditNotes: createFixtureCollection<CreditNote>({
    resource: 'Credit note',
    seed: () => creditNoteSeed(),
  }),
  // Credits carry the plan's reason chip, note, invoice and settle-by day — see payments-fixture-contracts.ts.
  pendingCredits: createFixtureCollection<PendingCreditRecord>({
    resource: 'Pending credit',
    seed: () => pendingCreditSeed(),
  }),
  // Closes carry the plan's recount, acceptor and review ticks — see payments-fixture-contracts.ts.
  dayCloses: createFixtureCollection<DayCloseRecord>({
    resource: 'Day close',
    seed: () => dayCloseSeed(),
  }),
  tasks: createFixtureCollection<TaskRecord>({
    resource: 'Task',
    seed: () => taskSeed(),
  }),
  manufacturers: createFixtureCollection<Manufacturer>({
    resource: 'Manufacturer',
    seed: () => manufacturerSeed(),
  }),
  suppliers: createFixtureCollection<Supplier>({
    resource: 'Supplier',
    seed: () => supplierSeed(),
  }),
  medicalReps: createFixtureCollection<MedicalRep>({
    resource: 'MR',
    seed: () => medicalRepSeed(),
  }),
  mrVisits: createFixtureCollection<MRVisit>({
    resource: 'MR visit',
    seed: () => mrVisitSeed(),
  }),
  // Medicines carry the plan's "Sold with" and near-expiry discount — see medicines-contracts.ts.
  medicines: createFixtureCollection<MedicineRecord>({
    resource: 'Medicine',
    seed: () => medicineSeed(),
  }),
  purchaseOrders: createFixtureCollection<MedicalPurchaseOrder>({
    resource: 'Purchase order',
    seed: () => purchaseOrderSeed(),
  }),
  medicalContacts: createFixtureCollection<MedicalContact>({
    resource: 'Contact',
    seed: () => medicalContactSeed(),
  }),
  medicalSales: createFixtureCollection<MedicalSale>({
    resource: 'Sale',
    seed: () => medicalSaleSeed(),
  }),
  stockVendors: createFixtureCollection<StockVendor>({
    resource: 'Vendor',
    seed: () => stockVendorSeed(),
  }),
  stockItems: createFixtureCollection<StockItem>({
    resource: 'Item',
    seed: () => stockItemSeed(),
  }),
  stockPurchases: createFixtureCollection<StockPurchase>({
    resource: 'Purchase',
    seed: () => stockPurchaseSeed(),
  }),
  stockMovements: createFixtureCollection<StockMovement>({
    resource: 'Movement',
    seed: () => stockMovementSeed(),
  }),
  stockCounts: createFixtureCollection<StockCount>({
    resource: 'Stock check',
    seed: () => stockCountSeed(),
    sequenced: false,
  }),
};

/** The clinic itself — one record, not a collection (it has no audit fields). */
export function clinicOrganization(): Organization {
  return organizationSeed();
}

const resetHooks = new Set<() => void>();

/**
 * Register fixture-server state that lives outside the collections — the task
 * rule settings, the Undo log — so it clears with the world.
 */
export function onClinicFixturesReset(hook: () => void): void {
  resetHooks.add(hook);
}

/** Forget every change and reseed each collection on its next read (tests). */
export function resetClinicFixtures(): void {
  for (const collection of Object.values(clinicFixtures)) collection.reset();
  for (const hook of resetHooks) hook();
}
