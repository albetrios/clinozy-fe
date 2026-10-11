import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import {
  createCredit,
  creditQueryKeys,
  deleteCredit,
  fetchCredit,
  listPendingCredits,
  restoreCredit,
  settleCredit,
  updateCredit,
} from '@/shared/api/app/credits-api.ts';
import type {
  CreditInput,
  CreditListParams,
  CreditRow,
  CreditSettlement,
  CreditSettleResult,
} from '@/shared/api/app/credits-contracts.ts';
import { taskQueryKeys } from '@/shared/api/app/tasks-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/** What a credit write refreshes: every money read, and the tasks (a Settle by day opens one). */
const CREDIT_WRITE_KEYS = [...MONEY_WRITE_KEYS, taskQueryKeys.all];

// ── Reads ──

/**
 * Payments › Pending, 50 rows a page (`GET /app/pending-credits`, each with who added it). While
 * new params load the previous rows stay; a failed read raises no toast here — the room keeps
 * the last copy and offers Retry (§6.0 List error).
 */
export function useCreditList(params: CreditListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<CreditRow>({
    queryKey: creditQueryKeys.list(organizationId, params),
    queryFn: async (after) => {
      const page = await listPendingCredits(params, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    enabled: organizationId !== null,
    notifyOnError: false,
  });
}

/** One credit by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useCredit(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: creditQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchCredit(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

// ── Writes ──

/**
 * Add pending — not optimistic. No toast of its own: the drawer says "CR-3 saved · give ₹500 to
 * Tanvi Shah".
 */
export function useCreateCredit(
  options: CrudMutationOptions<CreditRow, CreditInput> = {},
) {
  return useAppMutation<CreditRow, CreditInput>({
    mutationFn: (input, action) =>
      createCredit({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: CREDIT_WRITE_KEYS,
    ...options,
  });
}

/** What a credit save sends: the credit as read and the drawer's fields. */
export interface CreditUpdateVars {
  credit: CreditRow;
  input: CreditInput;
}

/**
 * Save an open credit — not optimistic; refused when someone saved it meanwhile or part of it is
 * settled (409). The drawer says "CR-1 updated".
 */
export function useUpdateCredit(
  options: CrudMutationOptions<CreditRow, CreditUpdateVars> = {},
) {
  return useAppMutation<CreditRow, CreditUpdateVars>({
    mutationFn: ({ credit, input }, action) =>
      updateCredit({ credit, input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: CREDIT_WRITE_KEYS,
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
 * Delete a credit — optimistic: the row leaves every cached Pending page at once and comes back
 * if the write fails. The lists refresh, not the credit's own read. No toast of its own: the
 * Reason confirm's `reason.undo` says "CR-2 deleted" with Undo.
 */
export function useDeleteCredit(
  options: CrudMutationOptions<void, CreditDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, CreditDeleteVars, unknown, CreditRow>({
    mutationFn: ({ id, reason, note }) => deleteCredit({ creditId: id, reason, note }),
    invalidateKeys: [creditQueryKeys.lists(organizationId), taskQueryKeys.all],
    optimisticInfinite: {
      queryKey: creditQueryKeys.lists(organizationId),
      update: (rows, { id }) => rows.filter((row) => row.id !== id),
    },
    ...options,
  });
}

/** Put a deleted credit back — the Undo of its toast; silent on success. */
export function useRestoreCredit(options: CrudMutationOptions<CreditRow, string> = {}) {
  return useAppMutation<CreditRow, string>({
    mutationFn: (id, action) => restoreCredit(id, action.idempotencyKey),
    invalidateKeys: CREDIT_WRITE_KEYS,
    ...options,
  });
}

/** What a settlement sends: the credit as read and how it is settled. */
export interface CreditSettleVars {
  credit: CreditRow;
  settlement: CreditSettlement;
}

/**
 * Give back, Got it back or Use on a bill — not optimistic. No toast of its own: the caller says
 * "₹500 given back to Tanvi Shah · PAY-6" or "₹500 of CR-2 adjusted on invoice #785".
 */
export function useSettleCredit(
  options: CrudMutationOptions<CreditSettleResult, CreditSettleVars> = {},
) {
  return useAppMutation<CreditSettleResult, CreditSettleVars>({
    mutationFn: ({ credit, settlement }, action) =>
      settleCredit({ credit, settlement, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}
