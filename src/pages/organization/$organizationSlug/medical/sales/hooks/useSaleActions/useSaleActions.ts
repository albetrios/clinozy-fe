import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';
import { printInvoice } from '@/shared/components/InvoiceDrawer/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useDeletePayment } from '@/shared/hooks/usePayments/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useCollectSale } from '../../../shared/hooks/useMedicalFlows/index.ts';
import type { SaleRow } from '../../../shared/medical-contracts.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

/** A sale as its actions read it. */
type SaleState = Pick<SaleRow, 'id' | 'status' | 'paid' | 'due' | 'returns'>;

/** A sale as Print reads it: the invoice it prints. */
type SaleInvoice = Pick<SaleRow, 'invoiceId'>;

/** What {@link useSaleActions} hands the Sales tab and the Sale drawer. */
export interface SaleActions {
  /** "Collect ₹563": an unpaid sale, for members who edit Medical. */
  canCollect: (sale: SaleState) => boolean;
  /** "Return medicines": members who edit Medical. */
  canReturn: boolean;
  /**
   * "Void sale": an unpaid sale nothing was paid on or returned from, for
   * members with Medical Delete and the `void` ability (Q-M2, Q-U8).
   */
  canVoid: (sale: SaleState) => boolean;
  /** Record the sale's full due as one receipt; `onDone` runs once it is on the ledger. */
  collect: (sale: SaleState, onDone?: () => void) => void;
  /** The receipt is being written. */
  collecting: boolean;
  /**
   * "Print": the sale's invoice on the A4 sheet in its Medical form, the
   * browser's dialog 260ms after it renders (`medical.md:137–146`).
   */
  print: (sale: SaleInvoice) => void;
}

/**
 * What a sale offers (`medical.md:29, 338`) — the same on its row and in its
 * drawer — and Collect itself (KICKOFF §6.7 Money actions, Q-M1): the sale's
 * full due as one UPI receipt on the ledger against its invoice, the Receive
 * drawer's "Full · ₹X" preset in one tap, so it reaches Day close. "₹563
 * received" offers Undo, which deletes the receipt while its day is open; a
 * closed day or a settled sale answers with the server's message. Print reads
 * the sale's invoice — cached when the drawer read it — and prints it.
 */
export function useSaleActions(): SaleActions {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const queryClient = useQueryClient();
  const formatPaise = usePaiseFormat();
  const access = useClinicAccess();
  const collectSale = useCollectSale();
  const removeReceipt = useDeletePayment();
  const can = (action: 'edit' | 'delete') =>
    access.isResolved && access.can('medical', action);
  return {
    canCollect: (sale) => sale.status === 'unpaid' && can('edit'),
    canReturn: can('edit'),
    canVoid: (sale) =>
      sale.status === 'unpaid' &&
      sale.paid === 0 &&
      sale.returns.length === 0 &&
      can('delete') &&
      access.canAbility('void'),
    collecting: collectSale.isPending,
    print: (sale) =>
      void queryClient
        .fetchQuery({
          queryKey: invoiceQueryKeys.detail(sale.invoiceId),
          queryFn: () => fetchInvoice(sale.invoiceId),
        })
        .then(printInvoice)
        .catch((error: unknown) => notifyError(error)),
    collect: (sale, onDone) =>
      collectSale.mutate(sale.id, {
        onSuccess: (receipt) => {
          notify.undo(
            t(MEDICAL_DRAWER_KEYS.sale.collected, {
              amount: formatPaise(receipt.amount),
            }),
            {
              onUndo: () =>
                removeReceipt.mutate({ id: receipt.id, reason: 'mistake', note: null }),
            },
          );
          onDone?.();
        },
      }),
  };
}
