import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import type { DeleteReason } from './app-schema.ts';
import {
  prescriptionBodyOf,
  type PrescriptionFields,
  type PrescriptionKit,
  prescriptionKitWire,
  type PrescriptionRecord,
  prescriptionRowWire,
  prescriptionWire,
  rxBranchWire,
  rxMedicineWire,
  rxOrganizationWire,
  type RxSheetClinic,
  type RxStoreMedicine,
  toPrescriptionKit,
  toPrescriptionRecord,
  toRxStoreMedicine,
} from './prescriptions-contracts.ts';

/*
 * The patient file's prescriptions on clinozy-be (api-integration §5.4): a patient's list (every
 * page — the section shows them all), one prescription, write, change a draft (with the read's
 * `updated_at`), approve, delete a draft with its reason and restore it; the member's own kits;
 * the store's medicines the drawer suggests; and the clinic the printed sheet names. Every write
 * carries the action's key.
 */

/** TanStack Query keys for prescriptions, each carrying the organization. */
export const prescriptionQueryKeys = {
  all: ['app', 'prescriptions'] as const,
  /** Every patient's list — a write refreshes them. */
  lists: (organizationId: string | null) =>
    [...prescriptionQueryKeys.all, organizationId, 'list'] as const,
  /** One patient's prescriptions, newest first. */
  list: (organizationId: string | null, patientId: string) =>
    [...prescriptionQueryKeys.lists(organizationId), patientId] as const,
  /** Every prescription's own read — a save refreshes them, a delete does not (it would 404). */
  details: (organizationId: string | null) =>
    [...prescriptionQueryKeys.all, organizationId, 'detail'] as const,
  detail: (organizationId: string | null, patientId: string, prescriptionId: string) =>
    [
      ...prescriptionQueryKeys.details(organizationId),
      patientId,
      prescriptionId,
    ] as const,
  /** The member's kits. */
  kits: (organizationId: string | null) =>
    [...prescriptionQueryKeys.all, organizationId, 'kits'] as const,
  /** The store's medicines the drawer suggests. */
  medicines: (organizationId: string | null) =>
    [...prescriptionQueryKeys.all, organizationId, 'medicines'] as const,
  /** The printed sheet's clinic and branch. */
  sheetClinic: (organizationId: string | null, branchId: string | null) =>
    [...prescriptionQueryKeys.all, organizationId, 'sheet', branchId] as const,
};

/** The API's largest page. */
const PAGE_SIZE = 100;

/** The next page's cursor, or null on the last. */
const nextOf = (pagination: { next?: string | null; has_more?: boolean } | undefined) =>
  pagination?.has_more ? (pagination.next ?? null) : null;

/** A patient's prescriptions, newest first: the prescription's day, then the server's order. */
export async function listPatientPrescriptions(
  patientId: string,
): Promise<PrescriptionRecord[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/prescriptions', {
      params: { patient_id: patientId },
      query: {
        sort: 'prescription_date',
        order: 'desc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(prescriptionRowWire)
        .parse(response.data ?? [])
        .map(toPrescriptionRecord),
      next: nextOf(response.meta?.pagination),
    };
  }, 'patient-prescriptions');
}

/** One prescription — a 404 when it is unknown or deleted. */
export async function fetchPrescription({
  patientId,
  prescriptionId,
}: {
  patientId: string;
  prescriptionId: string;
}): Promise<PrescriptionRecord> {
  const response = await api.get(
    '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}',
    { params: { patient_id: patientId, patient_prescription_id: prescriptionId } },
  );
  return toPrescriptionRecord(prescriptionWire.parse(response.data));
}

/**
 * Write a prescription — a draft (Q19). At a visit it names the visit's booking
 * (`appointment_id`); a 400 names a field the server refused.
 */
export async function createPrescription({
  patientId,
  fields,
  appointmentId = null,
  idempotencyKey,
}: {
  patientId: string;
  fields: PrescriptionFields;
  appointmentId?: string | null;
  idempotencyKey: string;
}): Promise<PrescriptionRecord> {
  const response = await api.post('/app/patients/{patient_id}/prescriptions', {
    params: { patient_id: patientId },
    body: {
      ...prescriptionBodyOf(fields),
      ...(appointmentId ? { appointment_id: appointmentId } : {}),
    },
    idempotencyKey,
  });
  return toPrescriptionRecord(prescriptionWire.parse(response.data));
}

/**
 * Save a draft's changes with the read's `updated_at` — `409 record_changed` when someone saved
 * it meanwhile, `409 prescription_approved` once it is approved.
 */
export async function updatePrescription({
  patientId,
  prescriptionId,
  fields,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  patientId: string;
  prescriptionId: string;
  fields: PrescriptionFields;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}): Promise<PrescriptionRecord> {
  const response = await api.patch(
    '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}',
    {
      params: { patient_id: patientId, patient_prescription_id: prescriptionId },
      body: { ...prescriptionBodyOf(fields), expected_updated_at: expectedUpdatedAt },
      idempotencyKey,
    },
  );
  return toPrescriptionRecord(prescriptionWire.parse(response.data));
}

/**
 * Approve a draft — final from then on, the approver recorded (Q19). A 400 when it has no line,
 * `409 transition_not_allowed` when it is approved already.
 */
export async function approvePrescription({
  patientId,
  prescriptionId,
  idempotencyKey,
}: {
  patientId: string;
  prescriptionId: string;
  idempotencyKey: string;
}): Promise<PrescriptionRecord> {
  const response = await api.post(
    '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}/approve',
    {
      params: { patient_id: patientId, patient_prescription_id: prescriptionId },
      idempotencyKey,
    },
  );
  return toPrescriptionRecord(prescriptionWire.parse(response.data));
}

/** Delete a draft with the reason the member picked (an approved one is `409 prescription_approved`). */
export async function deletePrescription({
  patientId,
  prescriptionId,
  reason,
  note,
}: {
  patientId: string;
  prescriptionId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/patients/{patient_id}/prescriptions/{patient_prescription_id}', {
    params: { patient_id: patientId, patient_prescription_id: prescriptionId },
    reason,
    note: note ?? undefined,
  });
}

/** Bring a deleted draft back — the Undo of its toast. */
export async function restorePrescription({
  patientId,
  prescriptionId,
  idempotencyKey,
}: {
  patientId: string;
  prescriptionId: string;
  idempotencyKey: string;
}): Promise<PrescriptionRecord> {
  const response = await api.post(
    '/app/patients/{patient_id}/prescriptions/{patient_prescription_id}/restore',
    {
      params: { patient_id: patientId, patient_prescription_id: prescriptionId },
      idempotencyKey,
    },
  );
  return toPrescriptionRecord(prescriptionWire.parse(response.data));
}

/** The member's own kits, A to Z (`patient_prescription:create`; another member's never list). */
export async function listPrescriptionKits(): Promise<PrescriptionKit[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/prescription-kits', {
      query: { sort: 'name', order: 'asc', limit: PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z
        .array(prescriptionKitWire)
        .parse(response.data ?? [])
        .map(toPrescriptionKit),
      next: nextOf(response.meta?.pagination),
    };
  }, 'prescription-kits');
}

/**
 * Every medicine in the store, A to Z (`medicine:read`) — the drawer's picker, quick line and
 * Browse search them as they are typed, so the whole store is read once.
 */
export async function listRxMedicines(): Promise<RxStoreMedicine[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/medicines', {
      query: { sort: 'name', order: 'asc', limit: PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z
        .array(rxMedicineWire)
        .parse(response.data ?? [])
        .map(toRxStoreMedicine),
      next: nextOf(response.meta?.pagination),
    };
  }, 'rx-medicines');
}

/**
 * The clinic the printed sheet names — its name and specialties (any member) — and the branch's
 * phone and GSTIN, read only by a member holding `branch:read` (without it the footer has none).
 */
export async function fetchRxSheetClinic({
  branchId,
  readsBranch,
}: {
  branchId: string | null;
  readsBranch: boolean;
}): Promise<RxSheetClinic> {
  const [organization, branch] = await Promise.all([
    api.get('/tenancy/organization'),
    branchId && readsBranch
      ? api.get('/app/branches/{branch_id}', { params: { branch_id: branchId } })
      : null,
  ]);
  const clinic = rxOrganizationWire.parse(organization.data);
  const contact = branch ? rxBranchWire.parse(branch.data) : null;
  return {
    organization: { name: clinic.name, specialties: clinic.specialties },
    branch: { phone: contact?.phone ?? '', gstNumber: contact?.gst_number ?? null },
  };
}
