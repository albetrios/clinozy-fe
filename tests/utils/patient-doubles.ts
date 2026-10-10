/**
 * Test data for the Patients room and the patient file as clinozy-be answers them
 * (`/app/patients`, `/app/contacts`): a list row, a record with every number, the file's read.
 * Ids are public ids (`<prefix>_<21 [a-z0-9]>`). Override what a test is about; the rest stays
 * a plausible new patient — Priya Shah, #3508, Aesthetic, at the main branch.
 */
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import type {
  PatientRecord,
  PatientRow,
} from '@/shared/api/clinic/patients-contracts.ts';

import { TEST_BRANCH_ID } from './appointment-doubles.ts';

/** Priya's patient id. */
export const TEST_PATIENT_ID = 'pat_priya0000000000000000';

/** Priya's contact id — the person the file points at. */
export const TEST_CONTACT_ID = 'con_priya0000000000000000';

/** A Patients list row — the primary number only. */
export function patientRow(overrides: Partial<PatientRow> = {}): PatientRow {
  return {
    id: TEST_PATIENT_ID,
    seq: 3508,
    contactId: TEST_CONTACT_ID,
    homeBranchId: TEST_BRANCH_ID,
    types: ['aesthetic'],
    status: 'new',
    conversion: 'not_converted',
    doctorId: null,
    followUpAt: null,
    notes: null,
    leadId: null,
    allergies: [],
    contraindications: [],
    createdAt: '2026-09-20T05:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    contactNumber: 1188,
    firstName: 'Priya',
    lastName: 'Shah',
    name: 'Priya Shah',
    phone: '+919876543210',
    email: null,
    gender: 'female',
    dateOfBirth: '1995-10-27',
    address: 'Adajan, Surat',
    referralSource: null,
    referredByContactId: null,
    referredByName: null,
    hasMarketingConsent: false,
    consents: ['data'],
    isAwaitingReply: false,
    contactUpdatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

/** One patient as the file reads them — the row with every number. */
export function patientRecord(overrides: Partial<PatientRecord> = {}): PatientRecord {
  const row = patientRow(overrides);
  return {
    ...row,
    phone2: null,
    phones: [{ phone: row.phone, isPrimary: true, isOnWhatsapp: true }],
    ...overrides,
  };
}

/** The file's read: the record, no next visit, no feedback yet. */
export function patientFile(overrides: Partial<PatientFile> = {}): PatientFile {
  return {
    patient: patientRecord(),
    instagram: null,
    language: null,
    nextVisit: null,
    feedback: { feel: null, score: null, review: null, checkIns: 0, reviews: 0 },
    awaitingReply: false,
    ...overrides,
  };
}
