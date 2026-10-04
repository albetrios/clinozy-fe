import {
  fetchAllMedicines,
  fetchMedicine,
  listMedicines,
  MEDICAL_ROOM_QUERY_KEY,
  medicineQueryKeys,
  setNearExpiryDiscount,
} from '@/shared/api/clinic/medicines-api.ts';
import type {
  MedicineListParams,
  MedicineRecord,
  MedicineRow,
} from '@/shared/api/clinic/medicines-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';

/**
 * What a medicine write refreshes: every medicine read, and the Medical
 * family's reads that join medicines (sales, orders, manufacturers' counts).
 */
export const MEDICINE_WRITE_KEYS = [
  medicineQueryKeys.all,
  MEDICAL_ROOM_QUERY_KEY,
] as const;

// ── Reads ──

/**
 * The Medicines list, a cursor page of 50 at a time (D7, `S:1660`) — Medical ›
 * Medicines' infinite scroll. While new params load the previous rows stay
 * (`isRefreshing`); a failed read raises no toast here — the room keeps the
 * last copy and offers Retry (KICKOFF §6.0 List error).
 */
export function useMedicineList(params: MedicineListParams) {
  return useCursorList<MedicineRow>({
    queryKey: medicineQueryKeys.list(params),
    queryFn: async (after) => {
      const page = await listMedicines(params, after ?? null);
      return {
        rows: page.items,
        next: page.nextCursor,
        hasMore: page.nextCursor !== null,
      };
    },
    notifyOnError: false,
  });
}

/** Every live medicine — the pickers' catalogue (New sale, the purchase order, the Rx drawer). */
export function useMedicineCatalogue() {
  return useAppQuery({
    queryKey: medicineQueryKeys.catalogue(),
    queryFn: () => fetchAllMedicines(),
  });
}

/** One medicine as its row; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useMedicine(id: string | undefined) {
  return useAppQuery({
    queryKey: medicineQueryKeys.detail(id ?? ''),
    queryFn: () => fetchMedicine(id ?? ''),
    enabled: Boolean(id),
  });
}

// ── Writes ──

/** What the near-expiry discount write sends: the medicines and the percent (0 removes it). */
export interface NearExpiryDiscountVars {
  ids: readonly string[];
  pct: number;
}

/**
 * Sell at 20% off near expiry, or remove it (Q-M3; a plan field, Appendix F)
 * — the row's toggle and "Sell all at 20% off". The caller toasts, with Undo.
 */
export function useSetNearExpiryDiscount(
  options: CrudMutationOptions<MedicineRecord[], NearExpiryDiscountVars> = {},
) {
  return useAppMutation<MedicineRecord[], NearExpiryDiscountVars>({
    mutationFn: ({ ids, pct }) => setNearExpiryDiscount(ids, pct),
    invalidateKeys: [...MEDICINE_WRITE_KEYS],
    ...options,
  });
}
