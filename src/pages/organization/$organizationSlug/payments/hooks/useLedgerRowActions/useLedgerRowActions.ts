import { useTranslation } from 'react-i18next';

import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { PenLine, Trash } from '@/shared/icons/index.ts';

import { ledgerEntryLock } from '../../components/LedgerCells/index.ts';
import type { PaymentDeleteTarget } from '../../components/PaymentDeleteConfirm/index.ts';
import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';

/** What the actions do: open the entry's drawer, ask to delete it. */
export interface LedgerRowActionHandlers {
  onEdit: (row: LedgerRow) => void;
  onDelete: (target: PaymentDeleteTarget) => void;
}

/**
 * An entry's row actions (`payments.md:34`) — the ledger's and Day close's
 * review alike: Edit with the room's Edit, Delete with its Delete (the delete
 * confirm names what the invoice goes back to); none on a locked entry — a
 * closed day's, or a credit's.
 */
export function useLedgerRowActions({
  onEdit,
  onDelete,
}: LedgerRowActionHandlers): (row: LedgerRow) => DataTableRowAction[] {
  const { t } = useTranslation(PAYMENTS_NS);
  const access = useClinicAccess();
  const can = (action: 'edit' | 'delete') =>
    access.isResolved && access.can('payments', action);
  return (row) => {
    if (ledgerEntryLock(row, t)) return [];
    const actions: DataTableRowAction[] = [];
    if (can('edit')) {
      actions.push({
        id: 'edit',
        label: t(PAYMENTS_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => onEdit(row),
      });
    }
    if (can('delete')) {
      actions.push({
        id: 'delete',
        label: t(PAYMENTS_KEYS.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () =>
          onDelete({
            entry: row,
            dueAfter: row.invoice ? row.invoice.due + row.amount : undefined,
          }),
      });
    }
    return actions;
  };
}
