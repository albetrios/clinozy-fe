import { Outlet, useSearch } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { Printer, RefreshCw, Trash, Wallet } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { SALE_STATUSES, validateMedicalSearch } from '../medical.search.ts';
import {
  MedicalFlowConfirm,
  type MedicalFlowTarget,
} from '../shared/components/MedicalFlowConfirm/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { useMedicalSummary, useSaleList } from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import type {
  PrescriptionToFill,
  SaleListParams,
  SaleRow,
} from '../shared/medical-contracts.ts';
import { SALE_STATUS_TONES } from '../shared/medical-tones.ts';
import { PaymentReminders } from './components/PaymentReminders/index.ts';
import { PrescriptionsToFill } from './components/PrescriptionsToFill/index.ts';
import { SaleDrawers } from './components/SaleDrawers/index.ts';
import { salePaymentOf, useSaleActions } from './hooks/useSaleActions/index.ts';
import { useSaleColumns } from './hooks/useSaleColumns/index.ts';
import { saleFilterKey, saleParamsOf } from './sales.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.sales;

/** The Sales Filters (`medical.md:39`): Status (All · Unpaid · Paid · Returned) · Created. */
const SALE_FILTER_FIELDS = {
  status: { kind: 'options', values: SALE_STATUSES, single: true },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

/**
 * The Sales view action for the Status filter (`medical.md:17`): All →
 * "Prescriptions to fill" (for members who create sales), Unpaid → "Send
 * payment reminders" (Q-M6); Paid and Returned → none, and no actions slot.
 */
function salesViewAction({
  status,
  params,
  canCreate,
  onPickPrescription,
}: {
  status: SaleListParams['status'];
  params: SaleListParams;
  canCreate: boolean;
  onPickPrescription: (prescription: PrescriptionToFill) => void;
}): ReactNode {
  if (status === 'unpaid') return <PaymentReminders params={params} />;
  if (!status && canCreate) return <PrescriptionsToFill onPick={onPickPrescription} />;
  return null;
}

/**
 * Medical › Sales (KICKOFF §6.7; `medical.md:25–39`), the room's first tab on
 * clinozy-be (`GET /app/medical-sales`): the Medical toolbar — "Prescriptions
 * to fill" with Status All, "Send payment reminders" with Unpaid — over the
 * sales table. A row opens the read-only Sale; "Collect ₹563" records the due
 * on the ledger (Q-M1, `payment:create`), "Return medicines" — a sale paid in
 * full, `payment:delete` (MD23, MD24) — opens Return from patient, "Print"
 * prints the sale's invoice on the A4 sheet, and an unpaid sale with nothing
 * paid or returned can be voided (Q-M2). New sale is the shared Invoice
 * drawer, Medical locked. The search, Status, Created and the sort live in the
 * URL; the footer counts the sales they match. The dialog routes render
 * nothing: this page opens their drawers.
 */
export function SalesPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const formatRupees = useRupeeFormat();
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = saleParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(SALE_FILTER_FIELDS);
  const actions = useSaleActions();
  const [voiding, setVoiding] = useState<MedicalFlowTarget | null>(null);

  const list = useSaleList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, saleFilterKey(params));
  const summary = useMedicalSummary('sales', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useSaleColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const canCreate = access.isResolved && access.can('medical', 'create');
  const keys = MEDICAL_KEYS.sales.rowActions;
  const statuses = MEDICAL_KEYS.sales.statuses;

  const rowActions = (sale: SaleRow): DataTableRowAction[] => {
    const offered: DataTableRowAction[] = [];
    if (actions.canCollect(sale)) {
      offered.push({
        id: 'collect',
        label: t(keys.collect, { amount: formatRupees(sale.due) }),
        icon: Wallet,
        onSelect: () => actions.collect(sale),
      });
    }
    if (actions.canReturn(sale)) {
      offered.push({
        id: 'return',
        label: t(keys.return),
        icon: RefreshCw,
        onSelect: () => nav.saleReturn(sale.id),
      });
    }
    offered.push({
      id: 'print',
      label: t(keys.print),
      icon: Printer,
      onSelect: () => actions.print(sale),
    });
    if (actions.canVoid(sale)) {
      offered.push({
        id: 'void',
        label: t(keys.void),
        icon: Trash,
        destructive: true,
        onSelect: () =>
          setVoiding({
            kind: 'voidSale',
            id: sale.id,
            seq: sale.seq,
            record: sale.customer?.name ?? `#${sale.seq}`,
          }),
      });
    }
    return offered;
  };

  return (
    <section data-testid="medical-sales-page" className="flex min-h-0 flex-1 flex-col">
      <MedicalToolbar
        tab="sales"
        table={table}
        filters={{
          fields: SALE_FILTER_FIELDS,
          copy: {
            status: {
              label: t(MEDICAL_KEYS.filters.status),
              anyLabel: t(MEDICAL_KEYS.filters.all),
              options: {
                unpaid: { label: t(statuses.unpaid), tone: 'blush' },
                paid: { label: t(statuses.paid), tone: 'sage' },
                returned: { label: t(statuses.returned), tone: 'lav' },
              },
            },
          },
        }}
        viewAction={salesViewAction({
          status: search.status,
          params,
          canCreate,
          onPickPrescription: (rx) =>
            nav.create('sales', { prescription: rx.id, customer: rx.contactId }),
        })}
      />
      <MedicalTable
        tab="sales"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(MEDICAL_KEYS.empty.store)}
        emptyAction={
          canCreate
            ? { label: t(MEDICAL_KEYS.create.sale), onSelect: () => nav.create('sales') }
            : undefined
        }
        recordsLabel={t(MEDICAL_KEYS.sales.records)}
        countLabel={
          summary ? t(MEDICAL_KEYS.sales.count, { count: summary.total }) : undefined
        }
        minWidth={1100}
        onRowClick={(sale) => nav.sale(sale.id)}
        rowTone={(sale) => SALE_STATUS_TONES[salePaymentOf(sale)]}
        rowActions={rowActions}
        exportName="sales.csv"
        exportValue={(columnId, sale) =>
          columnId === 'customer' ? (sale.customer?.name ?? '') : undefined
        }
        avatar
      />
      <SaleDrawers />
      <MedicalFlowConfirm target={voiding} onClose={() => setVoiding(null)} />
      <Outlet />
    </section>
  );
}
