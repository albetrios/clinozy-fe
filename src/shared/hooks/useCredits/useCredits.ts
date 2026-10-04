import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  createCredit,
  creditQueryKeys,
  deleteCredit,
  fetchCredit,
  listPendingCredits,
  restoreCredit,
  settleCredit,
  updateCredit,
} from '@/shared/api/clinic/credits-api.ts';
import type {
  CreditInput,
  CreditListParams,
  CreditRow,
  CreditSettlement,
  CreditSettleResult,
  PendingCreditRecord,
} from '@/shared/api/clinic/credits-contracts.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';

// ── Reads ──

/**
 * Payments › Pending, a cursor page of 50 at a time (D7, `S:1700`). While new
 * params load the previous rows stay; a failed read raises no toast here — the
 * room keeps the last copy and offers Retry (§6.0 List error).
 */
export function useCreditList(params: CreditListParams) {
  return useCursorList<CreditRow>({
    queryKey: creditQueryKeys.list(params),
    queryFn: async (after) => {
      const page = await listPendingCredits(params, after ?? null);
      return {
        rows: page.items,
        next: page.nextCursor,
        hasMore: page.nextCursor !== null,
      };
    },
    notifyOnError: false,
  });
}

/** One credit by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useCredit(id: string | undefined) {
  return useAppQuery({
    queryKey: creditQueryKeys.detail(id ?? ''),
    queryFn: () => fetchCredit(id ?? ''),
    enabled: Boolean(id),
  });
}

// ── Writes ──

/**
 * Add pending — not optimistic. No toast of its own: the drawer says "CR-3
 * saved · give ₹500 to Tanvi Shah". A Settle by day opens a task, so the Tasks
 * reads refresh too.
 */
export function useCreateCredit(
  options: CrudMutationOptions<PendingCreditRecord, CreditInput> = {},
) {
  return useAppMutation<PendingCreditRecord, CreditInput>({
    mutationFn: createCredit,
    invalidateKeys: [...MONEY_WRITE_KEYS, taskQueryKeys.all],
    ...options,
  });
}

/** What a credit save sends. */
export interface CreditUpdateVars {
  id: string;
  input: CreditInput;
}

/** Save an open credit — not optimistic; the drawer says "CR-1 updated". */
export function useUpdateCredit(
  options: CrudMutationOptions<PendingCreditRecord, CreditUpdateVars> = {},
) {
  return useAppMutation<PendingCreditRecord, CreditUpdateVars>({
    mutationFn: ({ id, input }) => updateCredit(id, input),
    invalidateKeys: [...MONEY_WRITE_KEYS, taskQueryKeys.all],
    ...options,
  });
}

/** What a confirmed credit delete sends. */
export interface CreditDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a credit (`S:1546`) — optimistic: the row leaves every cached Pending
 * page at once and comes back if the write fails. No toast of its own: the
 * Reason confirm's `reason.undo` says "CR-2 deleted" with Undo.
 */
export function useDeleteCredit(
  options: CrudMutationOptions<PendingCreditRecord, CreditDeleteVars> = {},
) {
  return useAppMutation<PendingCreditRecord, CreditDeleteVars, unknown, CreditRow>({
    mutationFn: ({ id, reason, note }) => deleteCredit(id, reason, note),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    optimisticInfinite: {
      queryKey: creditQueryKeys.lists(),
      update: (rows, { id }) => rows.filter((row) => row.id !== id),
    },
    ...options,
  });
}

/** Put a deleted credit back — the Undo of its toast (10s, D32); silent on success. */
export function useRestoreCredit(
  options: CrudMutationOptions<PendingCreditRecord, string> = {},
) {
  return useAppMutation<PendingCreditRecord, string>({
    mutationFn: restoreCredit,
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** What a settlement sends. */
export interface CreditSettleVars {
  id: string;
  settlement: CreditSettlement;
}

/**
 * Give back, Got it back or Use on next bill — not optimistic. No toast of its
 * own: the caller says "₹500 given back to Tanvi Shah · Out entry added" or
 * "₹500 of CR-2 adjusted on invoice #785".
 */
export function useSettleCredit(
  options: CrudMutationOptions<CreditSettleResult, CreditSettleVars> = {},
) {
  return useAppMutation<CreditSettleResult, CreditSettleVars>({
    mutationFn: ({ id, settlement }) => settleCredit(id, settlement),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}
