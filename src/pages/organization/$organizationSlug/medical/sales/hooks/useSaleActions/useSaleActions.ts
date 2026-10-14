import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/app/invoices-api.ts';
import { printInvoice } from '@/shared/components/InvoiceDrawer/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { useDeletePayment } from '@/shared/hooks/usePayments/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import { useCollectSale } from '../../../shared/hooks/useMedicalFlows/index.ts';
import type { SaleRow } from '../../../shared/medical-contracts.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

/** Paid or Unpaid, as the sale's pill and row edge show it: what the server still has due. */
export type SalePayment = 'paid' | 'unpaid';

/** Whether the sale still owes, by the server's due (`medical.md:29`). */
export const salePaymentOf = (sale: Pick<SaleRow, 'due'>): SalePayment =>
  sale.due > 0 ? 'unpaid' : 'paid';

/** Whether any sold line is still with the customer — the server's `returned_quantity` read. */
const hasLinesOut = (sale: Pick<SaleRow, 'lines'>) =>
  sale.lines.some((line) => line.qty - line.returnedQty > 0);

/** What {@link useSaleActions} hands the Sales tab and the Sale drawer. */
export interface SaleActions {
  /** "Collect ₹563": a live sale still owing, for members who take money (`payment:create`). */
  canCollect: (sale: SaleRow) => boolean;
  /**
   * "Return medicines": a sale paid in full with something still out (MD24 — collect first),
   * for members who give money back (`payment:delete`, MD23).
   */
  canReturn: (sale: SaleRow) => boolean;
  /**
   * "Void sale": an unpaid sale nothing was paid on or returned from, for members with Medical
   * Delete (`medicine:delete`, Q-M2; the `void` ability retired on codes).
   */
  canVoid: (sale: SaleRow) => boolean;
  /** Record the sale's full due as one receipt; `onDone` runs once it is on the ledger. */
  collect: (sale: SaleRow, onDone?: () => void) => void;
  /** The receipt is being written. */
  collecting: boolean;
  /**
   * "Print": the sale's invoice on the A4 sheet in its Medical form under the sale's own number
   * ("S-983"), the browser's dialog 260ms after it renders (`medical.md:137–146`).
   */
  print: (sale: Pick<SaleRow, 'invoice' | 'seq'>) => void;
}

/**
 * What a sale offers (`medical.md:29, 338`) — the same on its row and in its
 * drawer — and Collect itself (KICKOFF §6.7 Money actions, Q-M1): the sale's
 * full due as one UPI receipt on the ledger against its invoice
 * (`POST /app/payments`), so it reaches Day close. "₹563 received" offers
 * Undo to a member who may delete a payment — it deletes the receipt while its
 * day is open; a closed day or a settled sale answers with the server's
 * message. Print reads the sale's invoice (`GET /app/invoices/:id`) — cached
 * once read — and prints it.
 */
export function useSaleActions(): SaleActions {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  const formatRupees = useRupeeFormat();
  const access = useAppAccess();
  const payments = usePaymentAccess();
  const collectSale = useCollectSale();
  const removeReceipt = useDeletePayment();
  const live = (sale: SaleRow) => sale.status !== 'voided' && sale.invoice !== null;
  return {
    canCollect: (sale) =>
      live(sale) && sale.due > 0 && sale.customer !== null && payments.canCreate,
    canReturn: (sale) =>
      live(sale) && sale.due <= 0 && hasLinesOut(sale) && payments.canDelete,
    canVoid: (sale) =>
      sale.status === 'unpaid' &&
      sale.paid === 0 &&
      sale.returns.length === 0 &&
      access.isResolved &&
      access.can('medical', 'delete'),
    collecting: collectSale.isPending,
    print: ({ invoice, seq }) => {
      if (!invoice) return;
      void queryClient
        .query({
          queryKey: invoiceQueryKeys.detail(organizationId, invoice.id),
          queryFn: () => fetchInvoice(invoice.id),
        })
        .then((detail) => printInvoice({ ...detail, sale: { seq } }))
        .catch((error: unknown) => notifyError(error));
    },
    collect: (sale, onDone) =>
      collectSale.mutate(
        { sale, mode: 'upi' },
        {
          onSuccess: (receipt) => {
            const message = t(MEDICAL_DRAWER_KEYS.sale.collected, {
              amount: formatRupees(receipt.amount),
            });
            if (payments.canDelete) {
              notify.undo(message, {
                onUndo: () =>
                  removeReceipt.mutate({ id: receipt.id, reason: 'mistake', note: null }),
              });
            } else {
              notify.success(message);
            }
            onDone?.();
          },
        },
      ),
  };
}
