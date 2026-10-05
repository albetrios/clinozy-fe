import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { InvoiceDrawer } from '@/shared/components/InvoiceDrawer/index.ts';
import {
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { Printer, RefreshCw, Trash, Wallet } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { SALE_STATUSES, validateMedicalSearch } from '../medical.search.ts';
import {
  MedicalFlowConfirm,
  type MedicalFlowTarget,
} from '../shared/components/MedicalFlowConfirm/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import {
  type MedicalDialogRoute,
  useMedicalDialogRoute,
} from '../shared/hooks/useMedicalDialogRoute/index.ts';
import { useMedicalSummary, useSaleList } from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import { fetchMedicalSale, medicalQueryKeys } from '../shared/medical-api.ts';
import type { SaleRow } from '../shared/medical-contracts.ts';
import { MEDICAL_DRAWER_KEYS } from '../shared/medical-drawers.constants.ts';
import { SALE_STATUS_TONES } from '../shared/medical-tones.ts';
import { PrescriptionsToFill } from './components/PrescriptionsToFill/index.ts';
import { SaleDrawer } from './components/SaleDrawer/index.ts';
import { SaleReturnDrawer } from './components/SaleReturnDrawer/index.ts';
import { useSaleActions } from './hooks/useSaleActions/index.ts';
import { useSaleColumns } from './hooks/useSaleColumns/index.ts';
import { saleFilterKey, saleParamsOf } from './sales.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.sales;

/** The Sales Filters (`medical.md:39`): Status (All · Unpaid · Returned) · Created. */
const SALE_FILTER_FIELDS = {
  status: { kind: 'options', values: SALE_STATUSES, single: true },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

/**
 * The drawer the URL names (D24): New sale — the shared Invoice drawer with the
 * type locked to Medical (`S:50`), on `?prescription=&customer=`, closing back
 * to `from` (Today's Dispense, AMBER A-P1) or the Sales list — the read-only
 * Sale, or Return from patient.
 */
function SaleDrawers({
  dialog,
  close,
  closeTo,
  onReturn,
}: {
  dialog: MedicalDialogRoute<SaleRow>;
  close: () => void;
  closeTo: (from: string | undefined) => void;
  onReturn: (sale: SaleRow) => void;
}) {
  if (dialog.kind === 'create') {
    const back = () => closeTo(dialog.prefill.from);
    return (
      <InvoiceDrawer
        mode="create"
        sale
        open
        prefill={{
          prescriptionId: dialog.prefill.prescription ?? null,
          patientId: dialog.prefill.customer ?? null,
        }}
        onClose={back}
        onCreated={back}
      />
    );
  }
  if (dialog.kind !== 'record') return null;
  if (dialog.action === 'return') {
    return <SaleReturnDrawer open sale={dialog.record} onClose={close} />;
  }
  return <SaleDrawer open sale={dialog.record} onClose={close} onReturn={onReturn} />;
}

/**
 * Medical › Sales (KICKOFF §6.7; `medical.md:25–39`), the room's first tab: the
 * Medical toolbar — "Prescriptions to fill" with Status All — over the sales
 * table. A row opens the read-only Sale; "Collect ₹563" records the due on
 * the ledger (Q-M1), "Return medicines" opens Return from patient, "Print"
 * prints the sale's invoice on the A4 sheet, and an unpaid sale with nothing
 * paid or returned can be voided (Q-M2). New sale is the shared Invoice
 * drawer, Medical locked. The search, Status, Created and the sort live in the
 * URL; the footer counts the sales they match. The dialog routes render
 * nothing: this page opens their drawers.
 */
export function SalesPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const formatPaise = usePaiseFormat();
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = saleParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(SALE_FILTER_FIELDS);
  const actions = useSaleActions();
  const [voiding, setVoiding] = useState<MedicalFlowTarget | null>(null);
  const { dialog, close } = useMedicalDialogRoute({
    tab: 'sales',
    param: 'saleId',
    queryKey: medicalQueryKeys.sale,
    fetchRecord: fetchMedicalSale,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.sale),
  });

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
        label: t(keys.collect, { amount: formatPaise(sale.due) }),
        icon: Wallet,
        onSelect: () => actions.collect(sale),
      });
    }
    if (actions.canReturn) {
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
                returned: { label: t(statuses.returned), tone: 'lav' },
              },
            },
          },
        }}
        viewAction={
          !search.status && canCreate ? (
            <PrescriptionsToFill
              onPick={(rx) =>
                nav.create('sales', { prescription: rx.id, customer: rx.patientId })
              }
            />
          ) : null
        }
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
        rowTone={(sale) => SALE_STATUS_TONES[sale.status]}
        rowActions={rowActions}
        exportName="sales.csv"
        exportValue={(columnId, sale) =>
          columnId === 'customer' ? (sale.customer?.name ?? '') : undefined
        }
        avatar
      />
      <SaleDrawers
        dialog={dialog}
        close={close}
        closeTo={(from) => nav.closeTo('sales', from)}
        onReturn={(sale) => nav.saleReturn(sale.id)}
      />
      <MedicalFlowConfirm target={voiding} onClose={() => setVoiding(null)} />
      <Outlet />
    </section>
  );
}
