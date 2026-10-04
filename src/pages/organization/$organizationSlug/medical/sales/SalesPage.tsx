import { Outlet, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { RefreshCw } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { SALE_STATUSES, validateMedicalSearch } from '../medical.search.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { useMedicalSummary, useSaleList } from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import type { SaleRow } from '../shared/medical-contracts.ts';
import { SALE_STATUS_TONES } from '../shared/medical-tones.ts';
import { useSaleColumns } from './hooks/useSaleColumns/index.ts';
import { saleFilterKey, saleParamsOf } from './sales.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.sales;

/** The Sales Filters (`medical.md:39`): Status (All · Unpaid · Returned) · Created. */
const SALE_FILTER_FIELDS = {
  status: { kind: 'options', values: SALE_STATUSES, single: true },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

/**
 * Medical › Sales (KICKOFF §6.7; `medical.md:25–39`), the room's first tab:
 * the Medical toolbar over the sales table — a row opens the read-only Sale,
 * "Return medicines" opens Return from patient. The search, Status, Created
 * and the sort live in the URL; the footer counts the sales they match.
 */
export function SalesPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = saleParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(SALE_FILTER_FIELDS);

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

  const canEdit = access.isResolved && access.can('medical', 'edit');
  const canCreate = access.isResolved && access.can('medical', 'create');
  const keys = MEDICAL_KEYS.sales.rowActions;
  const statuses = MEDICAL_KEYS.sales.statuses;

  const rowActions = (sale: SaleRow): DataTableRowAction[] =>
    canEdit
      ? [
          {
            id: 'return',
            label: t(keys.return),
            icon: RefreshCw,
            onSelect: () => nav.saleReturn(sale.id),
          },
        ]
      : [];

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
      <Outlet />
    </section>
  );
}
