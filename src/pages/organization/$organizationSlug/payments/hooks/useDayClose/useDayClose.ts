import {
  acceptOpeningCash,
  closeDay,
  dayCloseQueryKeys,
  fetchDayClose,
  reopenDay,
  setEntryChecked,
} from '@/shared/api/clinic/day-close-api.ts';
import type {
  AcceptOpeningInput,
  CloseDayInput,
  DayCloseRecord,
  DayCloseView,
  DayKey,
  EntryCheckInput,
} from '@/shared/api/clinic/day-close-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';

/** One branch-day as Day close draws it; idle until the branch is known. */
export function useDayClose(branchId: string | null, date: string) {
  return useAppQuery({
    queryKey: dayCloseQueryKeys.day(branchId ?? '', date),
    queryFn: () => fetchDayClose(branchId ?? '', date),
    enabled: branchId !== null,
  });
}

/**
 * Accept the opening cash — not optimistic (the gate's button waits); no
 * toast of its own: the drawer says "Opening cash ₹2,000 accepted · stamped
 * 09:12".
 */
export function useAcceptOpeningCash(
  options: CrudMutationOptions<DayCloseRecord, AcceptOpeningInput> = {},
) {
  return useAppMutation<DayCloseRecord, AcceptOpeningInput>({
    mutationFn: acceptOpeningCash,
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** Close the day on the count — the day's entries lock; the drawer says "Day closed · …". */
export function useCloseDay(
  options: CrudMutationOptions<DayCloseRecord, CloseDayInput> = {},
) {
  return useAppMutation<DayCloseRecord, CloseDayInput>({
    mutationFn: closeDay,
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** Reopen a day inside the grace period (Q-G1) — its entries unlock; "Day reopened". */
export function useReopenDay(options: CrudMutationOptions<DayCloseRecord, DayKey> = {}) {
  return useAppMutation<DayCloseRecord, DayKey>({
    mutationFn: reopenDay,
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/**
 * Tick or untick an entry in the review — optimistic: the box fills at once
 * and the progress moves; a failure puts it back.
 */
export function useEntryCheck(
  key: DayKey,
  options: CrudMutationOptions<DayCloseRecord, EntryCheckInput> = {},
) {
  return useAppMutation<DayCloseRecord, EntryCheckInput, DayCloseView>({
    mutationFn: setEntryChecked,
    invalidateKeys: [dayCloseQueryKeys.day(key.branchId, key.date)],
    optimistic: {
      queryKey: dayCloseQueryKeys.day(key.branchId, key.date),
      update: (view, { paymentId, checked }) =>
        view && {
          ...view,
          checkedIds: checked
            ? [...view.checkedIds.filter((id) => id !== paymentId), paymentId]
            : view.checkedIds.filter((id) => id !== paymentId),
        },
    },
    ...options,
  });
}
