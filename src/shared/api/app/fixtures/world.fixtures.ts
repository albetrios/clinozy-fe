import { createFixtureCollection } from '@/shared/api/app/app-fixture-store.ts';
import type {
  Branch,
  CheckIn,
  FeedbackAction,
  Invoice,
  LeadMessage,
  Organization,
  PatientImage,
  PatientNote,
  PatientPackage,
  PatientReport,
  Prescription,
  Review,
  Treatment,
} from '@/shared/api/app/app-schema.ts';
import type { AppointmentRecord } from '@/shared/api/app/appointments-fixture-contracts.ts';
import type { LeadRecord } from '@/shared/api/app/leads-fixture-contracts.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-fixture-contracts.ts';
import type { PatientRecord } from '@/shared/api/app/patients-fixture-contracts.ts';
import type { PaymentRecord } from '@/shared/api/app/payments-fixture-contracts.ts';
import type { StaffProfile } from '@/shared/api/app/staff-fixture-contracts.ts';
import type { TaskRecord } from '@/shared/api/app/tasks-fixture-contracts.ts';

import { appointmentSeed } from './appointments.fixtures.ts';
import { leadMessageSeed, leadSeed } from './leads.fixtures.ts';
import { invoiceSeed, paymentSeed } from './money.fixtures.ts';
import { offeringSeed } from './offerings.fixtures.ts';
import { branchSeed, organizationSeed } from './organization.fixtures.ts';
import {
  checkInSeed,
  feedbackActionSeed,
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
import { taskSeed } from './tasks.fixtures.ts';

/**
 * The clinic fixture world (D6, D37 — REPLACE_WITH_API): one in-memory
 * collection per contract entity, seeded from the prototype the first time it
 * is read, on the real clinic clock — the prototype's seed day is today. The
 * records cross-link by id like one database. Every room reads clinozy-be now
 * (Medical last, D168); what is left is what the chat column's lead and patient
 * threads read (`messages-api.ts`, `contact-threads-api.ts`) and the records
 * those point at. When an entity's API lands its collection is deleted.
 */
export const appFixtures = {
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
  invoices: createFixtureCollection<Invoice>({
    resource: 'Invoice',
    seed: () => invoiceSeed(),
  }),
  // Entries carry the plan's reference, edit log and bill photos — see payments-fixture-contracts.ts.
  payments: createFixtureCollection<PaymentRecord>({
    resource: 'Payment',
    seed: () => paymentSeed(),
  }),
  tasks: createFixtureCollection<TaskRecord>({
    resource: 'Task',
    seed: () => taskSeed(),
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
export function onAppFixturesReset(hook: () => void): void {
  resetHooks.add(hook);
}

/** Forget every change and reseed each collection on its next read (tests). */
export function resetAppFixtures(): void {
  for (const collection of Object.values(appFixtures)) collection.reset();
  for (const hook of resetHooks) hook();
}
