import type { QueryKey } from '@tanstack/react-query';

import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { MEDICINE_WRITE_KEYS } from '@/shared/hooks/useMedicines/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import {
  fetchMrVisits,
  fetchSupplierAccount,
  medicalQueryKeys,
} from '../../medical-api.ts';
import type {
  ManufacturerRow,
  MrRow,
  MrVisitRow,
  SupplierRow,
} from '../../medical-contracts.ts';
import {
  createManufacturer,
  createMedicalRep,
  createSupplier,
  deleteManufacturer,
  deleteMedicalRep,
  deleteSupplier,
  logMrVisit,
  quickCreateManufacturer,
  quickCreateMedicalRep,
  quickCreateSupplier,
  restoreManufacturer,
  restoreMedicalRep,
  restoreSupplier,
  updateManufacturer,
  updateMedicalRep,
  updateSupplier,
} from '../../medical-records-api.ts';
import type {
  ManufacturerInput,
  MedicalRepInput,
  MrVisitInput,
  SupplierInput,
} from '../../medical-records-contracts.ts';

/*
 * The Medical store's partner reads and writes for the drawers, each write carrying its action's
 * idempotency key: suppliers, manufacturers, MRs and their visits. Every write refreshes the room —
 * its rows name suppliers, makers and MRs — and the medicines, whose rows name their maker and best
 * supplier.
 */

/** A partner save: the record as read — its `updated_at` guards the save — and the drawer's fields. */
export interface PartnerUpdateVars<TRecord, TInput> {
  record: TRecord;
  input: TInput;
}

/** A partner delete: the record and the reason confirm's choice. */
export interface PartnerDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/** A supplier's quick create: the typed name and the makers its picker came from. */
export interface QuickSupplierVars {
  name: string;
  manufacturerIds?: readonly string[];
}

/** What a partner write refreshes: the room and its medicines. */
const PARTNER_KEYS: readonly QueryKey[] = MEDICINE_WRITE_KEYS;

/** A supplier's Account rows — its orders and credits (`medical.md:200`); idle without an id. */
export function useSupplierAccount(id: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.supplierAccount(organizationId, id ?? ''),
    queryFn: () => fetchSupplierAccount(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
    notifyOnError: false,
  });
}

/** An MR's logged visits, the latest first; idle without an id. */
export function useMrVisits(id: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.mrVisits(organizationId, id ?? ''),
    queryFn: () => fetchMrVisits(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
    notifyOnError: false,
  });
}

// ── Suppliers ──

/** New supplier. */
export function useCreateSupplier(
  options: CrudMutationOptions<SupplierRow, SupplierInput> = {},
) {
  return useAppMutation<SupplierRow, SupplierInput>({
    mutationFn: (input, action) => createSupplier({ input, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Edit supplier — refused when someone saved it since (`409 record_changed`). */
export function useUpdateSupplier(
  options: CrudMutationOptions<
    SupplierRow,
    PartnerUpdateVars<SupplierRow, SupplierInput>
  > = {},
) {
  return useAppMutation<SupplierRow, PartnerUpdateVars<SupplierRow, SupplierInput>>({
    mutationFn: (vars, action) => updateSupplier({ ...vars, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** "Add supplier “Om Pharma”" from a picker. */
export function useQuickCreateSupplier(
  options: CrudMutationOptions<SupplierRow, QuickSupplierVars> = {},
) {
  return useAppMutation<SupplierRow, QuickSupplierVars>({
    mutationFn: (vars, action) => quickCreateSupplier({ ...vars, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Delete a supplier with the reason confirm's choice — `409 supplier_has_dues` while owed. */
export function useDeleteSupplier(
  options: CrudMutationOptions<void, PartnerDeleteVars> = {},
) {
  return useAppMutation<void, PartnerDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteSupplier(id, reason, note),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Undo a supplier's delete (D32). */
export function useRestoreSupplier(
  options: CrudMutationOptions<SupplierRow, string> = {},
) {
  return useAppMutation<SupplierRow, string>({
    mutationFn: (id, action) => restoreSupplier(id, action.idempotencyKey),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

// ── Manufacturers ──

/** New manufacturer and its connections. */
export function useCreateManufacturer(
  options: CrudMutationOptions<ManufacturerRow, ManufacturerInput> = {},
) {
  return useAppMutation<ManufacturerRow, ManufacturerInput>({
    mutationFn: (input, action) => createManufacturer({ input, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Edit manufacturer and its connections — refused when someone saved it since. */
export function useUpdateManufacturer(
  options: CrudMutationOptions<
    ManufacturerRow,
    PartnerUpdateVars<ManufacturerRow, ManufacturerInput>
  > = {},
) {
  return useAppMutation<
    ManufacturerRow,
    PartnerUpdateVars<ManufacturerRow, ManufacturerInput>
  >({
    mutationFn: (vars, action) => updateManufacturer({ ...vars, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** "Add manufacturer “ACME”" from a picker. */
export function useQuickCreateManufacturer(
  options: CrudMutationOptions<ManufacturerRow, string> = {},
) {
  return useAppMutation<ManufacturerRow, string>({
    mutationFn: (name, action) => quickCreateManufacturer({ name, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Delete a manufacturer with the reason confirm's choice — refused while a medicine names it. */
export function useDeleteManufacturer(
  options: CrudMutationOptions<void, PartnerDeleteVars> = {},
) {
  return useAppMutation<void, PartnerDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteManufacturer(id, reason, note),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Undo a manufacturer's delete (D32). */
export function useRestoreManufacturer(
  options: CrudMutationOptions<ManufacturerRow, string> = {},
) {
  return useAppMutation<ManufacturerRow, string>({
    mutationFn: (id, action) => restoreManufacturer(id, action.idempotencyKey),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

// ── MRs ──

/** New MR. */
export function useCreateMedicalRep(
  options: CrudMutationOptions<MrRow, MedicalRepInput> = {},
) {
  return useAppMutation<MrRow, MedicalRepInput>({
    mutationFn: (input, action) => createMedicalRep({ input, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Edit MR — refused when someone saved them since. */
export function useUpdateMedicalRep(
  options: CrudMutationOptions<MrRow, PartnerUpdateVars<MrRow, MedicalRepInput>> = {},
) {
  return useAppMutation<MrRow, PartnerUpdateVars<MrRow, MedicalRepInput>>({
    mutationFn: (vars, action) => updateMedicalRep({ ...vars, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** "Add MR “Ravi”" from a picker. */
export function useQuickCreateMedicalRep(
  options: CrudMutationOptions<MrRow, string> = {},
) {
  return useAppMutation<MrRow, string>({
    mutationFn: (name, action) => quickCreateMedicalRep({ name, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Delete an MR with the reason confirm's choice. */
export function useDeleteMedicalRep(
  options: CrudMutationOptions<void, PartnerDeleteVars> = {},
) {
  return useAppMutation<void, PartnerDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteMedicalRep(id, reason, note),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Undo an MR's delete (D32). */
export function useRestoreMedicalRep(options: CrudMutationOptions<MrRow, string> = {}) {
  return useAppMutation<MrRow, string>({
    mutationFn: (id, action) => restoreMedicalRep(id, action.idempotencyKey),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}

/** Log MR visit — sets the MR's next visit when one is given. */
export function useLogMrVisit(
  options: CrudMutationOptions<MrVisitRow, MrVisitInput> = {},
) {
  return useAppMutation<MrVisitRow, MrVisitInput>({
    mutationFn: (input, action) => logMrVisit({ input, ...action }),
    invalidateKeys: [...PARTNER_KEYS],
    ...options,
  });
}
