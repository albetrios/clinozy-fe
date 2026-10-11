import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import {
  approvePrescription,
  createPrescription,
  deletePrescription,
  fetchRxSheetClinic,
  listPatientPrescriptions,
  listPrescriptionKits,
  listRxMedicines,
  prescriptionQueryKeys,
  restorePrescription,
  updatePrescription,
} from '@/shared/api/app/prescriptions-api.ts';
import {
  type PrescriptionFields,
  type PrescriptionRecord,
  type RxCatalog,
  rxCatalogOf,
} from '@/shared/api/app/prescriptions-contracts.ts';
import { todayQueryKeys } from '@/shared/api/app/today-api.ts';
import { passesPatientFileGate } from '@/shared/app/patient-file-sections.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/** How long the kits, the store's medicines and the sheet's clinic are reused. */
const CATALOG_STALE_MS = 5 * 60_000;

// ── Access ──

/** What the member may do with a patient's prescriptions. */
export interface PrescriptionAccess {
  /** The member's codes have answered — an unresolved `false` means "not known yet". */
  resolved: boolean;
  /** Write a new one (`patient_prescription:create`): Save prescription, Copy, the kits. */
  writes: boolean;
  /** Change a draft and approve it (`patient_prescription:update`): "Save & approve" (Q19). */
  approves: boolean;
  /** Delete a draft (`patient_prescription:delete`). */
  deletes: boolean;
  /** The store's medicines as suggestions (`medicine:read`). */
  readsMedicines: boolean;
  /** The printed footer's branch phone and GSTIN (`branch:read`). */
  readsBranch: boolean;
}

/**
 * The member's prescription access, from the codes in force (a View-as preview's too).
 */
export function usePrescriptionAccess(): PrescriptionAccess {
  const access = useAppAccess();
  return useMemo(() => {
    const resolved = access.isResolved;
    const writes = resolved && passesPatientFileGate(access, 'prescriptions');
    const holds = (code: string) => resolved && access.canCode(code);
    return {
      resolved,
      writes,
      approves: holds('patient_prescription:update'),
      deletes: holds('patient_prescription:delete'),
      readsMedicines: holds('medicine:read'),
      readsBranch: holds('branch:read'),
    };
  }, [access]);
}

// ── Reads ──

/** Options of {@link usePatientPrescriptions}. */
export interface PatientPrescriptionsOptions {
  /** Read only for a member who may see them (`patient_prescription:read`). */
  enabled?: boolean;
  /** Toast a failed read (default true); off where the screen shows the failure in place. */
  notifyOnError?: boolean;
}

/**
 * One patient's prescriptions, newest first (`GET …/prescriptions`, every page) — the section,
 * the Overview's card, Activity and the drawer's "Repeat last Rx"; idle without a patient.
 */
export function usePatientPrescriptions(
  patientId: string,
  { enabled = true, notifyOnError = true }: PatientPrescriptionsOptions = {},
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: prescriptionQueryKeys.list(organizationId, patientId),
    queryFn: () => listPatientPrescriptions(patientId),
    enabled: enabled && patientId !== '' && organizationId !== null,
    notifyOnError,
  });
}

/** The member's own kits (`GET /app/prescription-kits`) — the drawer's Quick fill. */
export function usePrescriptionKits({ enabled = true }: { enabled?: boolean } = {}) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: prescriptionQueryKeys.kits(organizationId),
    queryFn: listPrescriptionKits,
    enabled: enabled && organizationId !== null,
    staleTime: CATALOG_STALE_MS,
  });
}

/** The Rx drawer's medicines while they are being read. */
export interface RxCatalogRead {
  /** Undefined until the patient's prescriptions (and the store, when read) have answered. */
  data: RxCatalog | undefined;
}

/**
 * The Rx drawer's medicines (H:4806): the store's (`GET /app/medicines`, for a member holding
 * `medicine:read`) and every name the patient's prescriptions carry, each with the patient's
 * last line of it (`rxCatalogOf`). Idle without a patient. A failed store read leaves the
 * patient's own names.
 */
export function useRxCatalog(patientId: string): RxCatalogRead {
  const organizationId = useOrganizationId();
  const { readsMedicines } = usePrescriptionAccess();
  const reads = readsMedicines && patientId !== '';
  const prescriptions = usePatientPrescriptions(patientId);
  const store = useAppQuery({
    queryKey: prescriptionQueryKeys.medicines(organizationId),
    queryFn: listRxMedicines,
    enabled: reads && organizationId !== null,
    staleTime: CATALOG_STALE_MS,
  });
  const ready = prescriptions.data !== undefined && !(reads && store.isPending);
  const data = useMemo(
    () => (ready ? rxCatalogOf(store.data ?? [], prescriptions.data ?? []) : undefined),
    [ready, store.data, prescriptions.data],
  );
  return { data };
}

/** The printed sheet's clinic read — one key and fetch for the hook and a print that waits. */
function rxSheetClinicQuery(
  organizationId: string | null,
  branchId: string | null,
  readsBranch: boolean,
) {
  return {
    queryKey: [
      ...prescriptionQueryKeys.sheetClinic(organizationId, branchId),
      readsBranch,
    ] as const,
    queryFn: () => fetchRxSheetClinic({ branchId, readsBranch }),
    staleTime: CATALOG_STALE_MS,
  };
}

/** The printed sheet's clinic — its name and specialties — and the branch's phone and GSTIN. */
export function useRxSheetClinic(branchId: string | null) {
  const organizationId = useOrganizationId();
  const { resolved, readsBranch } = usePrescriptionAccess();
  return useAppQuery({
    ...rxSheetClinicQuery(organizationId, branchId, readsBranch),
    enabled: resolved && organizationId !== null,
  });
}

/**
 * Read a printed sheet's clinic now: the copy {@link useRxSheetClinic} keeps, else the
 * server's — so a print waits for it instead of skipping. A failed read toasts with Retry, as
 * the hook's does, and rejects.
 */
export function useLoadRxSheetClinic() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  const { readsBranch } = usePrescriptionAccess();
  return (branchId: string | null) =>
    // `query({ staleTime: 'static' })`, not the deprecated `ensureQueryData`: the copy
    // the hook keeps is served as it is, and the network is touched only on a miss.
    queryClient.query({
      ...rxSheetClinicQuery(organizationId, branchId, readsBranch),
      staleTime: 'static',
      meta: { notifyOnError: true },
    });
}

// ── Writes ──

/**
 * What a prescription write refreshes: every patient's list and every prescription's read,
 * Today's floor — its pharmacy card joins the approved prescription of each booking (D149) — and
 * the person's activity.
 */
const rxWriteKeys = (organizationId: string | null) => [
  prescriptionQueryKeys.lists(organizationId),
  prescriptionQueryKeys.details(organizationId),
  todayQueryKeys.floors(),
  // The person's activity: the server writes a `system` entry for a new Rx (`messageQueryKeys`,
  // named here so the hook does not load the messages module).
  ['app', 'messages'],
];

/**
 * Approve what was just written, when asked — "Save & approve" (Q19) — on its own key (the
 * write's key with `:approve`), so a retry replays the write and approves again. A failed
 * approval refreshes the lists first: the draft stands.
 */
function useApproveAfterWrite() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  return async (
    written: PrescriptionRecord,
    { approve, idempotencyKey }: { approve: boolean; idempotencyKey: string },
  ): Promise<PrescriptionRecord> => {
    if (!approve) return written;
    try {
      return await approvePrescription({
        patientId: written.patientId,
        prescriptionId: written.id,
        idempotencyKey: `${idempotencyKey}:approve`,
      });
    } catch (error) {
      void queryClient.invalidateQueries({
        queryKey: prescriptionQueryKeys.lists(organizationId),
      });
      throw error;
    }
  };
}

/** What a new prescription sends. */
export interface PrescriptionCreateVars {
  patientId: string;
  fields: PrescriptionFields;
  /** The booking of the visit it is written at (the visit flow); none from the section. */
  appointmentId?: string | null;
  /** Approve it once written — a member holding `patient_prescription:update` (Q19). */
  approve?: boolean;
}

/** Write a prescription — a draft, or approved with `approve`; the screen raises its own toast. */
export function useCreatePrescription(
  options: CrudMutationOptions<PrescriptionRecord, PrescriptionCreateVars> = {},
) {
  const organizationId = useOrganizationId();
  const approveAfter = useApproveAfterWrite();
  return useAppMutation<PrescriptionRecord, PrescriptionCreateVars>({
    mutationFn: async ({ patientId, fields, appointmentId, approve = false }, action) => {
      const created = await createPrescription({
        patientId,
        fields,
        appointmentId,
        idempotencyKey: action.idempotencyKey,
      });
      return approveAfter(created, { approve, idempotencyKey: action.idempotencyKey });
    },
    invalidateKeys: rxWriteKeys(organizationId),
    ...options,
  });
}

/** A draft's save: the read it changes (its `updated_at` refuses a stale save) and its fields. */
export interface PrescriptionUpdateVars {
  prescription: PrescriptionRecord;
  fields: PrescriptionFields;
  /** Approve it once saved (Q19). */
  approve?: boolean;
}

/** Save a draft's changes, and approve it with `approve`; the drawer raises its own toast. */
export function useUpdatePrescription(
  options: CrudMutationOptions<PrescriptionRecord, PrescriptionUpdateVars> = {},
) {
  const organizationId = useOrganizationId();
  const approveAfter = useApproveAfterWrite();
  return useAppMutation<PrescriptionRecord, PrescriptionUpdateVars>({
    mutationFn: async ({ prescription, fields, approve = false }, action) => {
      const saved = await updatePrescription({
        patientId: prescription.patientId,
        prescriptionId: prescription.id,
        fields,
        expectedUpdatedAt: prescription.updatedAt,
        idempotencyKey: action.idempotencyKey,
      });
      return approveAfter(saved, { approve, idempotencyKey: action.idempotencyKey });
    },
    invalidateKeys: rxWriteKeys(organizationId),
    ...options,
  });
}

/** The prescription a delete or a restore names. */
export type PrescriptionRef = Pick<PrescriptionRecord, 'id' | 'patientId'>;

/** A draft's delete: the record and the confirm's reason and note. */
export interface PrescriptionDeleteVars {
  prescription: PrescriptionRef;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a draft. The lists and Today refresh — not the prescription's own read, which would
 * answer 404 while its drawer closes. No toast of its own: the reason confirm's
 * "Prescription deleted" with Undo runs {@link useRestorePrescription}.
 */
export function useDeletePrescription(
  options: CrudMutationOptions<void, PrescriptionDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, PrescriptionDeleteVars>({
    mutationFn: ({ prescription, reason, note }) =>
      deletePrescription({
        patientId: prescription.patientId,
        prescriptionId: prescription.id,
        reason,
        note,
      }),
    invalidateKeys: [
      prescriptionQueryKeys.lists(organizationId),
      todayQueryKeys.floors(),
    ],
    ...options,
  });
}

/** Put a deleted draft back — the Undo of its toast; silent on success. */
export function useRestorePrescription(
  options: CrudMutationOptions<PrescriptionRecord, PrescriptionRef> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<PrescriptionRecord, PrescriptionRef>({
    mutationFn: (prescription, action) =>
      restorePrescription({
        patientId: prescription.patientId,
        prescriptionId: prescription.id,
        idempotencyKey: action.idempotencyKey,
      }),
    invalidateKeys: rxWriteKeys(organizationId),
    ...options,
  });
}
