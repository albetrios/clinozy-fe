import { createFixtureCollection } from '@/shared/api/clinic/clinic-fixture-store.ts';
import type {
  Appointment,
  Branch,
  CheckIn,
  CreditNote,
  DayClose,
  FeedbackAction,
  Invoice,
  LeadMessage,
  Manufacturer,
  MedicalContact,
  MedicalPurchaseOrder,
  MedicalRep,
  MedicalSale,
  Medicine,
  MRVisit,
  OfferingSuggestion,
  Organization,
  Patient,
  PatientImage,
  PatientNote,
  PatientPackage,
  PatientReport,
  Payment,
  PendingCredit,
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
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import type { TaskRecord } from '@/shared/api/clinic/tasks-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';

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
  // A staff profile carries the plan's role keys and membership link (Appendix F) — see users-contracts.ts.
  staff: createFixtureCollection<StaffProfile>({
    resource: 'User',
    seed: () => staffSeed(),
  }),
  patients: createFixtureCollection<Patient>({
    resource: 'Patient',
    seed: () => patientSeed(),
  }),
  // Leads carry the plan's hold, unread and custom-interest fields — see leads-contracts.ts.
  leads: createFixtureCollection<LeadRecord>({
    resource: 'Lead',
    seed: () => leadSeed(),
  }),
  leadMessages: createFixtureCollection<LeadMessage>({
    resource: 'Message',
    seed: () => leadMessageSeed(),
  }),
  appointments: createFixtureCollection<Appointment>({
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
  patientPackages: createFixtureCollection<PatientPackage>({
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
  // The offerings domain carries the plan's fields (Appendix F) — see offerings-contracts.ts.
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
  payments: createFixtureCollection<Payment>({
    resource: 'Payment',
    seed: () => paymentSeed(),
  }),
  creditNotes: createFixtureCollection<CreditNote>({
    resource: 'Credit note',
    seed: () => creditNoteSeed(),
  }),
  pendingCredits: createFixtureCollection<PendingCredit>({
    resource: 'Pending credit',
    seed: () => pendingCreditSeed(),
  }),
  dayCloses: createFixtureCollection<DayClose>({
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
  medicines: createFixtureCollection<Medicine>({
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
