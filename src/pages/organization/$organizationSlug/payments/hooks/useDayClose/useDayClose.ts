import {
  acceptOpeningCash,
  closeDay,
  dayCloseQueryKeys,
  fetchDayClose,
  reopenDay,
} from '@/shared/api/clinic/day-close-api.ts';
import type {
  AcceptOpeningInput,
  CloseDayInput,
  DayCloseRecord,
  ReopenDayInput,
} from '@/shared/api/clinic/day-close-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/** One branch-day as Day close draws it; idle until the branch is known. */
export function useDayClose(branchId: string | null, date: string) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: dayCloseQueryKeys.day(organizationId, branchId ?? '', date),
    queryFn: () => fetchDayClose(branchId ?? '', date),
    enabled: branchId !== null && organizationId !== null,
  });
}

/**
 * Accept the opening cash (`payment:update`) — not optimistic (the gate's button waits); no
 * toast of its own: the drawer says "Opening cash ₹2,000 accepted · stamped 09:12".
 */
export function useAcceptOpeningCash(
  options: CrudMutationOptions<DayCloseRecord, AcceptOpeningInput> = {},
) {
  return useAppMutation<DayCloseRecord, AcceptOpeningInput>({
    mutationFn: (input, action) =>
      acceptOpeningCash({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/**
 * Close the day on the count (`payment:update`) — the day's money locks; the drawer says "Day
 * closed · …".
 */
export function useCloseDay(
  options: CrudMutationOptions<DayCloseRecord, CloseDayInput> = {},
) {
  return useAppMutation<DayCloseRecord, CloseDayInput>({
    mutationFn: (input, action) =>
      closeDay({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** Reopen a closed day with why (`payment:delete`) — its money unlocks; "Day reopened". */
export function useReopenDay(
  options: CrudMutationOptions<DayCloseRecord, ReopenDayInput> = {},
) {
  return useAppMutation<DayCloseRecord, ReopenDayInput>({
    mutationFn: (input, action) =>
      reopenDay({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}
