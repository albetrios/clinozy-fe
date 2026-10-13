import { useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/app/invoices-api.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import {
  appCommandNavigation,
  type AppCommandTarget,
} from '@/shared/app/app-command-targets.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { printInvoice } from '@/shared/components/InvoiceDrawer/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { Copy, Eye, PenLine, Printer, Trash, Wallet } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
} from '../../../shared/components/PatientSectionTable/index.ts';

const keys = PATIENT_TABLE_KEYS;

/** What an Invoices row does, and whether a member may open Edit invoice from it. */
export interface InvoiceRowActions {
  actions: (invoice: InvoiceRecord) => DataTableRowAction[];
  /** A row opens Edit invoice for a member who may change it, else the preview. */
  open: (invoice: InvoiceRecord) => void;
}

/**
 * Whether the file may change an invoice at all: never a Medical sale's (Medical voids those)
 * nor one with money on a closed day (`is_settled` — the drawer reads it only).
 */
const changeable = (invoice: InvoiceRecord) =>
  invoice.type !== 'medical' && !invoice.isSettled;

/**
 * An Invoices row's actions (KICKOFF §6.6 Section tables; H:4748), on the
 * shared Invoice drawer (L-40), each opening over the file's Invoices, which
 * stays behind it (`from`, §4, A-P1 — `useAppNavigate`), by the invoice's
 * public id: "Print" (the A4 sheet straight to the printer), "Preview",
 * "Copy invoice" (a new invoice prefilled from this one — its lines and
 * discount, today's date, nothing paid; `payment:create`, never a sale's),
 * "Record payment" (Receive payment for this invoice, while the server says it
 * owes — `payment:create`), "Edit" (`payment:update`) and "Delete"
 * (`payment:delete`), neither on a sale's invoice nor on a settled one.
 */
export function useInvoiceRowActions({
  onDelete,
}: {
  /** Opens "Delete this invoice?". */
  onDelete: (invoice: InvoiceRecord) => void;
}): InvoiceRowActions {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useAppNavigate();
  const queryClient = useQueryClient();
  const access = usePaymentAccess();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const referrer = `patients/${patientId}/invoices`;

  const go = (target: AppCommandTarget, invoice: InvoiceRecord) =>
    void navigate(
      appCommandNavigation(target, {
        organizationSlug,
        recordId: invoice.id,
        referrer,
      }),
    );
  const print = async (invoice: InvoiceRecord) => {
    try {
      await printInvoice(
        await queryClient.query({
          queryKey: invoiceQueryKeys.detail(organizationId, invoice.id),
          queryFn: () => fetchInvoice(invoice.id),
        }),
      );
    } catch (error) {
      notifyError(error);
    }
  };
  const copy = (invoice: InvoiceRecord) =>
    void navigate(
      appCommandNavigation('newInvoice', {
        organizationSlug,
        referrer,
        search: { type: invoice.type, patient: patientId, copyOf: invoice.id },
      }),
    );
  const pay = (invoice: InvoiceRecord) =>
    void navigate(
      appCommandNavigation('newReceipt', {
        organizationSlug,
        referrer,
        search: { patient: patientId, invoice: invoice.id },
      }),
    );

  const actions = (invoice: InvoiceRecord): DataTableRowAction[] => {
    const mayChange = changeable(invoice);
    // Each action with whether this member sees it on this invoice, in the menu's order.
    const offered: readonly [boolean, DataTableRowAction][] = [
      [
        true,
        {
          id: 'print',
          label: t(keys.actions.print),
          icon: Printer,
          onSelect: () => void print(invoice),
        },
      ],
      [
        true,
        {
          id: 'preview',
          label: t(keys.actions.preview),
          icon: Eye,
          onSelect: () => go('invoice', invoice),
        },
      ],
      [
        access.canCreate && invoice.type !== 'medical',
        {
          id: 'copy',
          label: t(keys.actions.copyInvoice),
          icon: Copy,
          onSelect: () => copy(invoice),
        },
      ],
      [
        access.canCreate && invoice.due > 0,
        {
          id: 'pay',
          label: t(keys.actions.pay),
          icon: Wallet,
          onSelect: () => pay(invoice),
        },
      ],
      [
        access.canEdit && mayChange,
        {
          id: 'edit',
          label: t(keys.actions.edit),
          icon: PenLine,
          onSelect: () => go('invoiceEdit', invoice),
        },
      ],
      [
        access.canDelete && mayChange,
        {
          id: 'delete',
          label: t(keys.actions.delete),
          icon: Trash,
          destructive: true,
          onSelect: () => onDelete(invoice),
        },
      ],
    ];
    return offered.filter(([shown]) => shown).map(([, action]) => action);
  };

  return {
    actions,
    open: (invoice) =>
      go(access.canEdit && changeable(invoice) ? 'invoiceEdit' : 'invoice', invoice),
  };
}
