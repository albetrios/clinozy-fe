import type { QueryKey } from '@tanstack/react-query';

import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import { commandSearchQueryKeys } from '@/shared/api/app/command-search-api.ts';
import { MEDICAL_ROOM_QUERY_KEY } from '@/shared/api/app/medicines-api.ts';
import { fixturePatientQueryKeys } from '@/shared/api/app/patients-fixture-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import {
  deleteFixturePayment,
  fixtureLedgerQueryKeys,
  listFixtureLedger,
  listFixtureOpenSupplierBills,
  restoreFixturePayment,
} from '@/shared/api/app/payments-fixture-api.ts';
import type {
  FixtureLedgerListParams,
  PaymentRecord,
} from '@/shared/api/app/payments-fixture-contracts.ts';
import { STOCK_ROOM_QUERY_KEY } from '@/shared/api/app/stock-room-query-key.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';

/*
 * The fixture ledger the parked Medical room reads (D153 seam): Medical › Payments' list in the
 * live ledger's row shape, the fixture supplier bills behind "Pay all received", and the delete
 * and Undo of a fixture entry. The Payments room reads clinozy-be (`usePayments`); this goes with
 * the Medical room's move.
 */

/**
 * What a fixture money write refreshes: the fixture ledger, the fixture patients (their dues),
 * ⌘K, and the rooms whose rows carry money — Medical's and Clinic stock's.
 */
export const FIXTURE_MONEY_WRITE_KEYS: readonly QueryKey[] = [
  fixtureLedgerQueryKeys.all,
  fixturePatientQueryKeys.all,
  commandSearchQueryKeys.all,
  MEDICAL_ROOM_QUERY_KEY,
  STOCK_ROOM_QUERY_KEY,
];

/**
 * The fixture ledger for Medical › Payments, a cursor page of 50 at a time — rows in the live
 * ledger's shape. A failed read raises no toast: the room offers Retry.
 */
export function useFixtureLedgerList(params: FixtureLedgerListParams) {
  return useCursorList<LedgerRow>({
    queryKey: fixtureLedgerQueryKeys.list(params),
    queryFn: async (after) => {
      const page = await listFixtureLedger(params, after ?? null);
      return {
        rows: page.items,
        next: page.nextCursor,
        hasMore: page.nextCursor !== null,
      };
    },
    notifyOnError: false,
  });
}

/** The fixture supplier bills with a balance (paise) — Medical's "Pay all received". */
export function useFixtureOpenSupplierBills() {
  return useAppQuery({
    queryKey: fixtureLedgerQueryKeys.openBills(),
    queryFn: listFixtureOpenSupplierBills,
  });
}

/** What a confirmed fixture entry delete sends: the entry and the Reason confirm's choice. */
export interface FixturePaymentDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete an open-day fixture entry — optimistic on the fixture ledger's pages; the Undo runs
 * {@link useFixtureRestorePayment}.
 */
export function useFixtureDeletePayment(
  options: CrudMutationOptions<PaymentRecord, FixturePaymentDeleteVars> = {},
) {
  return useAppMutation<PaymentRecord, FixturePaymentDeleteVars, unknown, LedgerRow>({
    mutationFn: ({ id, reason, note }) => deleteFixturePayment(id, reason, note),
    invalidateKeys: [...FIXTURE_MONEY_WRITE_KEYS],
    optimisticInfinite: {
      queryKey: fixtureLedgerQueryKeys.lists(),
      update: (rows, { id }) => rows.filter((row) => row.id !== id),
    },
    ...options,
  });
}

/** Put a deleted fixture entry back — the Undo of its "removed" toast; silent on success. */
export function useFixtureRestorePayment(
  options: CrudMutationOptions<PaymentRecord, string> = {},
) {
  return useAppMutation<PaymentRecord, string>({
    mutationFn: restoreFixturePayment,
    invalidateKeys: [...FIXTURE_MONEY_WRITE_KEYS],
    ...options,
  });
}
