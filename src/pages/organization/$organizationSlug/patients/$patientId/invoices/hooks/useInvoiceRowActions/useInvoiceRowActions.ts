import { useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';
import type { PatientInvoiceRow } from '@/shared/api/clinic/payments-contracts.ts';
import {
  clinicCommandNavigation,
  type ClinicCommandTarget,
} from '@/shared/clinic/clinic-command-targets.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { printInvoice } from '@/shared/components/InvoiceDrawer/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { Copy, Eye, PenLine, Printer, Trash, Wallet } from '@/shared/icons/index.ts';

import {
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
} from '../../../shared/components/PatientSectionTable/index.ts';

const keys = PATIENT_TABLE_KEYS;

/** What an Invoices row does, and whether a member may open Edit invoice from it. */
export interface InvoiceRowActions {
  actions: (invoice: PatientInvoiceRow) => DataTableRowAction[];
  /** A row opens Edit invoice for a member who may edit, else the preview. */
  open: (invoice: PatientInvoiceRow) => void;
}

/**
 * An Invoices row's actions (KICKOFF §6.6 Section tables; H:4748), on the
 * shared Invoice drawer (L-40), each opening over the file's Invoices, which
 * stays behind it (`from`, §4, A-P1 — `useClinicNavigate`): "Print" (the A4
 * sheet straight to the printer), "Preview",
 * "Copy invoice" (a new invoice prefilled from this one — its lines and
 * discount, today's date, nothing paid; `payments.create`), "Record payment"
 * (Receive payment for this invoice, while it owes — `payments.create`),
 * "Edit" (`payments.edit`) and "Delete" (`payments.edit` and the `void`
 * ability, never a sale's invoice — Medical voids those).
 */
export function useInvoiceRowActions({
  onDelete,
}: {
  /** Opens "Delete this invoice?". */
  onDelete: (invoice: PatientInvoiceRow) => void;
}): InvoiceRowActions {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useClinicNavigate();
  const queryClient = useQueryClient();
  const access = useClinicAccess();
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const referrer = `patients/${patientId}/invoices`;
  const canPay = access.isResolved && access.can('payments', 'create');
  const canEdit = access.isResolved && access.can('payments', 'edit');
  const canVoid = canEdit && access.canAbility('void');

  const go = (target: ClinicCommandTarget, invoice: PatientInvoiceRow) =>
    void navigate(
      clinicCommandNavigation(target, {
        organizationSlug,
        recordId: invoice.id,
        referrer,
      }),
    );
  const print = async (invoice: PatientInvoiceRow) => {
    try {
      await printInvoice(
        await queryClient.query({
          queryKey: invoiceQueryKeys.detail(invoice.id),
          queryFn: () => fetchInvoice(invoice.id),
        }),
      );
    } catch (error) {
      notifyError(error);
    }
  };
  const copy = (invoice: PatientInvoiceRow) =>
    void navigate(
      clinicCommandNavigation('newInvoice', {
        organizationSlug,
        referrer,
        search: { type: invoice.type, patient: patientId, copyOf: invoice.id },
      }),
    );
  const pay = (invoice: PatientInvoiceRow) =>
    void navigate(
      clinicCommandNavigation('newReceipt', {
        organizationSlug,
        referrer,
        search: { patient: patientId, invoice: invoice.id },
      }),
    );

  const actions = (invoice: PatientInvoiceRow): DataTableRowAction[] => {
    const list: DataTableRowAction[] = [
      {
        id: 'print',
        label: t(keys.actions.print),
        icon: Printer,
        onSelect: () => void print(invoice),
      },
      {
        id: 'preview',
        label: t(keys.actions.preview),
        icon: Eye,
        onSelect: () => go('invoice', invoice),
      },
    ];
    if (canPay) {
      list.push({
        id: 'copy',
        label: t(keys.actions.copyInvoice),
        icon: Copy,
        onSelect: () => copy(invoice),
      });
    }
    if (canPay && invoice.due > 0) {
      list.push({
        id: 'pay',
        label: t(keys.actions.pay),
        icon: Wallet,
        onSelect: () => pay(invoice),
      });
    }
    if (canEdit) {
      list.push({
        id: 'edit',
        label: t(keys.actions.edit),
        icon: PenLine,
        onSelect: () => go('invoiceEdit', invoice),
      });
    }
    if (canVoid && invoice.saleId === null) {
      list.push({
        id: 'delete',
        label: t(keys.actions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => onDelete(invoice),
      });
    }
    return list;
  };

  return {
    actions,
    open: (invoice) => go(canEdit ? 'invoiceEdit' : 'invoice', invoice),
  };
}
