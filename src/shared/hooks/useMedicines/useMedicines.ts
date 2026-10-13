import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import {
  createMedicine,
  deleteMedicine,
  fetchAllMedicines,
  fetchMedicine,
  listMedicines,
  MEDICAL_ROOM_QUERY_KEY,
  medicineQueryKeys,
  quickCreateMedicine,
  restoreMedicine,
  setNearExpiryDiscount,
  setNearExpiryDiscountWithin,
  updateMedicine,
} from '@/shared/api/app/medicines-api.ts';
import type {
  MedicineInput,
  MedicineListParams,
  MedicineRow,
  QuickMedicineInput,
} from '@/shared/api/app/medicines-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * What a medicine write refreshes: every medicine read, and the Medical room's reads that show
 * medicines (sales, orders, manufacturers' counts).
 */
export const MEDICINE_WRITE_KEYS = [
  medicineQueryKeys.all,
  MEDICAL_ROOM_QUERY_KEY,
] as const;

// ── Reads ──

/**
 * The Medicines list on clinozy-be, a cursor page of 50 at a time — Medical › Medicines' infinite
 * scroll, under the active organization and idle until there is one. While new params load the
 * previous rows stay (`isRefreshing`); a failed read raises no toast here — the room keeps the
 * last copy and offers Retry (KICKOFF §6.0 List error).
 */
export function useMedicineList(params: MedicineListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<MedicineRow>({
    queryKey: medicineQueryKeys.list(organizationId, params),
    queryFn: async (after) => {
      const page = await listMedicines(params, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/**
 * Every live medicine — the pickers' catalogue (New sale, the purchase order, the Rx drawer);
 * idle while `enabled` is false (the Invoice drawer reads it for a Medical sale only).
 */
export function useMedicineCatalogue({ enabled = true }: { enabled?: boolean } = {}) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicineQueryKeys.catalogue(organizationId),
    queryFn: () => fetchAllMedicines(),
    enabled: enabled && organizationId !== null,
  });
}

/** One medicine as its row; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useMedicine(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicineQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchMedicine(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

// ── Writes ──

/** What the near-expiry discount write sends: the medicines as read and the percent (0 removes it). */
export interface NearExpiryDiscountVars {
  medicines: readonly Pick<MedicineRow, 'id' | 'updatedAt'>[];
  pct: number;
}

/**
 * Sell at 20% off near expiry, or remove it (Q-M3) — the row's toggle and its Undo. The caller
 * toasts, with Undo.
 */
export function useSetNearExpiryDiscount(
  options: CrudMutationOptions<MedicineRow[], NearExpiryDiscountVars> = {},
) {
  return useAppMutation<MedicineRow[], NearExpiryDiscountVars>({
    mutationFn: ({ medicines, pct }, action) =>
      setNearExpiryDiscount(medicines, pct, action.idempotencyKey),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}

/** What "Sell all at 20% off" sends: the window and the percent (0 removes it). */
export interface NearExpiryWindowVars {
  expiringWithinDays: 30 | 60 | 90;
  pct: number;
}

/** "Sell all at 20% off" — every medicine expiring within the window, in one write; answers how many. */
export function useSetNearExpiryDiscountWithin(
  options: CrudMutationOptions<number, NearExpiryWindowVars> = {},
) {
  return useAppMutation<number, NearExpiryWindowVars>({
    mutationFn: ({ expiringWithinDays, pct }, action) =>
      setNearExpiryDiscountWithin(expiringWithinDays, pct, action.idempotencyKey),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}

/** Create a medicine from its drawer. */
export function useCreateMedicine(
  options: CrudMutationOptions<MedicineRow, MedicineInput> = {},
) {
  return useAppMutation<MedicineRow, MedicineInput>({
    mutationFn: (input, action) => createMedicine(input, action.idempotencyKey),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}

/** What a medicine save sends: the medicine as read — its `updated_at` guards the save — and the drawer's fields. */
export interface MedicineUpdateVars {
  record: MedicineRow;
  input: MedicineInput;
}

/** Save a medicine — refused when someone saved it since (`409 record_changed`); a quick record loses its flag. */
export function useUpdateMedicine(
  options: CrudMutationOptions<MedicineRow, MedicineUpdateVars> = {},
) {
  return useAppMutation<MedicineRow, MedicineUpdateVars>({
    mutationFn: ({ record, input }, action) =>
      updateMedicine(record, input, action.idempotencyKey),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}

/**
 * "Add medicine “Azel cream”" from a picker: MRP ₹0, "Needs MRP and composition" until a full
 * save.
 */
export function useQuickCreateMedicine(
  options: CrudMutationOptions<MedicineRow, QuickMedicineInput> = {},
) {
  return useAppMutation<MedicineRow, QuickMedicineInput>({
    mutationFn: (input, action) => quickCreateMedicine(input, action.idempotencyKey),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}

/** What a medicine delete sends: the record and the reason confirm's choice. */
export interface MedicineDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Soft-delete a medicine: optimistic — the row leaves every Medicines list at once and comes back
 * if the write fails.
 */
export function useDeleteMedicine(
  options: CrudMutationOptions<void, MedicineDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, MedicineDeleteVars, unknown, MedicineRow>({
    mutationFn: ({ id, reason, note }) => deleteMedicine(id, reason, note),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    optimisticInfinite: {
      queryKey: medicineQueryKeys.lists(organizationId),
      update: (rows, { id }) => rows.filter((row) => row.id !== id),
    },
    ...options,
  });
}

/** Put a deleted medicine back — the Undo of its toast (10s, D32). */
export function useRestoreMedicine(
  options: CrudMutationOptions<MedicineRow, string> = {},
) {
  return useAppMutation<MedicineRow, string>({
    mutationFn: (id, action) => restoreMedicine(id, action.idempotencyKey),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}
