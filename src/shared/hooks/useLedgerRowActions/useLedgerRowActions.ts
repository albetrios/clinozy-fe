import { useTranslation } from 'react-i18next';

import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  LEDGER_KEYS,
  LEDGER_NS,
  ledgerEntryEditable,
  ledgerEntryLock,
  ledgerEntryReversible,
} from '@/shared/components/LedgerCells/index.ts';
import type { PaymentDeleteTarget } from '@/shared/components/PaymentDeleteConfirm/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { PenLine, RotateCw, Trash } from '@/shared/icons/index.ts';

/** What the actions do: open the entry's drawer, ask to delete it, ask to reverse it. */
export interface LedgerRowActionHandlers {
  onEdit: (row: LedgerRow) => void;
  onDelete: (target: PaymentDeleteTarget) => void;
  /** A closed day's entry: ask to reverse it. Absent, no Reverse is offered (Day close's review). */
  onReverse?: (row: LedgerRow) => void;
}

/** A closed day's entry's one action: Reverse, for those who may (`payment:delete`). */
function reverseActions(
  row: LedgerRow,
  onReverse: ((row: LedgerRow) => void) | undefined,
  label: string,
): DataTableRowAction[] {
  if (!(onReverse && ledgerEntryReversible(row))) return [];
  return [
    {
      id: 'reverse',
      label,
      icon: RotateCw,
      destructive: true,
      onSelect: () => onReverse(row),
    },
  ];
}

/**
 * An entry's row actions (`payments.md:34`) — the ledger's and Day close's review alike: on an
 * open day Edit (`payment:update`; a receipt, an expense or a supplier bill — a refund's and a
 * reversal's money is fixed) and Delete (`payment:delete`; the confirm names what the invoice
 * goes back to); on a closed day Reverse (`payment:delete`), once, never on a reversal. A pending
 * credit's entry offers nothing: it is the credit's.
 */
export function useLedgerRowActions({
  onEdit,
  onDelete,
  onReverse,
}: LedgerRowActionHandlers): (row: LedgerRow) => DataTableRowAction[] {
  const { t } = useTranslation(LEDGER_NS);
  const access = usePaymentAccess();
  return (row) => {
    if (row.isSettled) {
      return access.canDelete
        ? reverseActions(row, onReverse, t(LEDGER_KEYS.rowActions.reverse))
        : [];
    }
    if (ledgerEntryLock(row, t)) return [];
    const actions: DataTableRowAction[] = [];
    if (access.canEdit && ledgerEntryEditable(row)) {
      actions.push({
        id: 'edit',
        label: t(LEDGER_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => onEdit(row),
      });
    }
    if (access.canDelete) {
      actions.push({
        id: 'delete',
        label: t(LEDGER_KEYS.rowActions.delete),
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
