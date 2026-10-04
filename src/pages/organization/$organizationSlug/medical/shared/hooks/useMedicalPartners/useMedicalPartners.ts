import type {
  DeleteReason,
  Manufacturer,
  MedicalRep,
  MRVisit,
  Supplier,
} from '@/shared/api/clinic/clinic-schema.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { MEDICINE_WRITE_KEYS } from '@/shared/hooks/useMedicines/index.ts';

import { fetchSupplierAccount, medicalQueryKeys } from '../../medical-api.ts';
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
} from '../../medical-partners-api.ts';
import type {
  ManufacturerInput,
  MedicalRepInput,
  MrVisitInput,
  SupplierInput,
} from '../../medical-partners-contracts.ts';

/*
 * The Medical store's partner reads and writes for the drawers (KICKOFF §6.7):
 * every write refreshes the room — its lists join supplier, maker and MR names
 * — and the medicines, whose rows name their maker and best supplier.
 */

/** A partner save: the record and its patch. */
export interface PartnerUpdateVars<TInput> {
  id: string;
  patch: TInput;
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

/** One write of the room, refreshing what it joins. */
function useMedicalWrite<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: CrudMutationOptions<TData, TVars>,
) {
  return useAppMutation<TData, TVars>({
    mutationFn,
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}

/** A supplier's Account rows (`medical.md:200`); idle without an id. */
export function useSupplierAccount(id: string | null) {
  return useAppQuery({
    queryKey: medicalQueryKeys.supplierAccount(id ?? ''),
    queryFn: () => fetchSupplierAccount(id ?? ''),
    enabled: Boolean(id),
    notifyOnError: false,
  });
}

// ── Suppliers ──

/** New supplier (`S:1675`). */
export function useCreateSupplier(
  options: CrudMutationOptions<Supplier, SupplierInput> = {},
) {
  return useMedicalWrite(createSupplier, options);
}

/** Edit supplier (`S:1675`). */
export function useUpdateSupplier(
  options: CrudMutationOptions<Supplier, PartnerUpdateVars<Partial<SupplierInput>>> = {},
) {
  return useMedicalWrite(({ id, patch }) => updateSupplier(id, patch), options);
}

/** "Add supplier “Om Pharma”" from a picker. */
export function useQuickCreateSupplier(
  options: CrudMutationOptions<Supplier, QuickSupplierVars> = {},
) {
  return useMedicalWrite(
    ({ name, manufacturerIds }) => quickCreateSupplier(name, manufacturerIds),
    options,
  );
}

/** Delete a supplier with the reason confirm's choice (`S:1546`). */
export function useDeleteSupplier(
  options: CrudMutationOptions<Supplier, PartnerDeleteVars> = {},
) {
  return useMedicalWrite(
    ({ id, reason, note }) => deleteSupplier(id, reason, note),
    options,
  );
}

/** Undo a supplier's delete (D32). */
export function useRestoreSupplier(options: CrudMutationOptions<Supplier, string> = {}) {
  return useMedicalWrite(restoreSupplier, options);
}

// ── Manufacturers ──

/** New manufacturer and its connections (`S:1675`). */
export function useCreateManufacturer(
  options: CrudMutationOptions<Manufacturer, ManufacturerInput> = {},
) {
  return useMedicalWrite(createManufacturer, options);
}

/** Edit manufacturer and its connections (`S:1675`). */
export function useUpdateManufacturer(
  options: CrudMutationOptions<Manufacturer, PartnerUpdateVars<ManufacturerInput>> = {},
) {
  return useMedicalWrite(({ id, patch }) => updateManufacturer(id, patch), options);
}

/** "Add manufacturer “acme”" from a picker. */
export function useQuickCreateManufacturer(
  options: CrudMutationOptions<Manufacturer, string> = {},
) {
  return useMedicalWrite(quickCreateManufacturer, options);
}

/** Delete a manufacturer with the reason confirm's choice (`S:1546`). */
export function useDeleteManufacturer(
  options: CrudMutationOptions<Manufacturer, PartnerDeleteVars> = {},
) {
  return useMedicalWrite(
    ({ id, reason, note }) => deleteManufacturer(id, reason, note),
    options,
  );
}

/** Undo a manufacturer's delete (D32). */
export function useRestoreManufacturer(
  options: CrudMutationOptions<Manufacturer, string> = {},
) {
  return useMedicalWrite(restoreManufacturer, options);
}

// ── MRs ──

/** New MR (`S:1675`). */
export function useCreateMedicalRep(
  options: CrudMutationOptions<MedicalRep, MedicalRepInput> = {},
) {
  return useMedicalWrite(createMedicalRep, options);
}

/** Edit MR (`S:1675`). */
export function useUpdateMedicalRep(
  options: CrudMutationOptions<
    MedicalRep,
    PartnerUpdateVars<Partial<MedicalRepInput>>
  > = {},
) {
  return useMedicalWrite(({ id, patch }) => updateMedicalRep(id, patch), options);
}

/** "Add MR “Ravi”" from a picker. */
export function useQuickCreateMedicalRep(
  options: CrudMutationOptions<MedicalRep, string> = {},
) {
  return useMedicalWrite(quickCreateMedicalRep, options);
}

/** Delete an MR with the reason confirm's choice (`S:1546`). */
export function useDeleteMedicalRep(
  options: CrudMutationOptions<MedicalRep, PartnerDeleteVars> = {},
) {
  return useMedicalWrite(
    ({ id, reason, note }) => deleteMedicalRep(id, reason, note),
    options,
  );
}

/** Undo an MR's delete (D32). */
export function useRestoreMedicalRep(
  options: CrudMutationOptions<MedicalRep, string> = {},
) {
  return useMedicalWrite(restoreMedicalRep, options);
}

/** Log MR visit (`logMRVisit`, `S:1676`). */
export function useLogMrVisit(options: CrudMutationOptions<MRVisit, MrVisitInput> = {}) {
  return useMedicalWrite(logMrVisit, options);
}
