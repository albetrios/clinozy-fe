import { useMemo } from 'react';

import { fetchAllInvoices, invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';
import type {
  InvoiceListParams,
  InvoiceRecord,
} from '@/shared/api/clinic/invoices-contracts.ts';
import { TODAY_REFETCH_MS } from '@/shared/api/clinic/today-contracts.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import type { TodayDues } from '../../today.flags.ts';

/** No dues read yet, or none to read. */
const NO_DUES: TodayDues = new Map();

/** What each person owes on the day's open invoices: the server's `due_amount`, by contact. */
function duesByContact(invoices: readonly InvoiceRecord[]): TodayDues {
  const dues = new Map<string, number>();
  for (const invoice of invoices) {
    if (invoice.contactId === null) continue;
    dues.set(invoice.contactId, (dues.get(invoice.contactId) ?? 0) + invoice.due);
  }
  return dues;
}

/**
 * Today's checkout money (research-payments G-P17): one read of the day's open invoices in the
 * header's branches — `GET /app/invoices?invoice_date_from=&invoice_date_to=` (`today`, the
 * clinic day) `&payment_status=unpaid,partial&branch_id=`, every page — joined to the floor's
 * Checkout cards by contact: "₹1,500 to pay". Read only while `enabled` (the Checkout lane is
 * open with people in it) and for a member who reads money (`payment:read`); polled with the
 * floor and refreshed by every money write (its key sits under the invoices'). A failed read
 * shows nothing: the cards keep their action.
 */
export function useCheckoutDues({
  enabled,
  today,
}: {
  enabled: boolean;
  /** The clinic day the floor is on. */
  today: string;
}): TodayDues {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const { preferences, isPending: preferencesPending } = usePreferences();
  const access = usePaymentAccess();
  const params: InvoiceListParams = {
    status: ['unpaid', 'partial'],
    branchIds: preferences.branchFilter,
    day: today,
  };
  const invoices = useAppQuery({
    queryKey: invoiceQueryKeys.every(organizationId, params),
    queryFn: () => fetchAllInvoices(params),
    enabled: enabled && access.canRead && !preferencesPending && organizationId !== null,
    refetchInterval: TODAY_REFETCH_MS,
    // A failed read leaves the cards without "to pay"; their action still opens the bill.
    notifyOnError: false,
  });
  const { data } = invoices;
  return useMemo(() => (data ? duesByContact(data) : NO_DUES), [data]);
}
