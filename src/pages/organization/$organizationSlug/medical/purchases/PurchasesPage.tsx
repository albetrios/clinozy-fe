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
import { Eye, PenLine, SquareCheck } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { PURCHASE_STAGES, validateMedicalSearch } from '../medical.search.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import {
  useMedicalSummary,
  usePurchaseOrderList,
} from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import type { PurchaseOrderRow } from '../shared/medical-contracts.ts';
import { PURCHASE_STAGE_TONES } from '../shared/medical-tones.ts';
import { usePurchaseOrderColumns } from './hooks/usePurchaseOrderColumns/index.ts';
import { purchaseOrderFilterKey, purchaseOrderParamsOf } from './purchases.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.purchases;

/** The Purchases Filters (`medical.md:71`): Stage (All · Ordered · Received · Paid) · Created. */
const PURCHASE_FILTER_FIELDS = {
  stage: { kind: 'options', values: PURCHASE_STAGES, single: true },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

/**
 * Medical › Purchases (KICKOFF §6.7; `medical.md:57–71`): the Medical toolbar
 * over the purchase orders. The sequence follows the stage (`medical.md:434`):
 * an Ordered order opens for editing and offers "Receive goods"; a Received
 * or Paid one opens its read-only view. The search, Stage, Created and the
 * sort live in the URL; the footer counts the orders they match.
 */
export function PurchasesPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = purchaseOrderParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(PURCHASE_FILTER_FIELDS);

  const list = usePurchaseOrderList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, purchaseOrderFilterKey(params));
  const summary = useMedicalSummary('purchases', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: usePurchaseOrderColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const canEdit = access.isResolved && access.can('medical', 'edit');
  const canCreate = access.isResolved && access.can('medical', 'create');
  const keys = MEDICAL_KEYS.purchases;

  /** Ordered → the editable order; Received or Paid → the read-only view (`S:58–59`). */
  const open = (order: PurchaseOrderRow) =>
    order.stage === 'ordered' && canEdit
      ? nav.purchaseOrderEdit(order.id)
      : nav.purchaseOrder(order.id);

  const rowActions = (order: PurchaseOrderRow): DataTableRowAction[] => {
    if (order.stage !== 'ordered') {
      return [
        {
          id: 'view',
          label: t(keys.rowActions.view),
          icon: Eye,
          onSelect: () => nav.purchaseOrder(order.id),
        },
      ];
    }
    if (!canEdit) return [];
    return [
      {
        id: 'receive',
        label: t(keys.rowActions.receive),
        icon: SquareCheck,
        onSelect: () => nav.purchaseOrderReceive(order.id),
      },
      {
        id: 'edit',
        label: t(keys.rowActions.edit),
        icon: PenLine,
        onSelect: () => nav.purchaseOrderEdit(order.id),
      },
    ];
  };

  return (
    <section
      data-testid="medical-purchases-page"
      className="flex min-h-0 flex-1 flex-col"
    >
      <MedicalToolbar
        tab="purchases"
        table={table}
        filters={{
          fields: PURCHASE_FILTER_FIELDS,
          copy: {
            stage: {
              label: t(MEDICAL_KEYS.filters.stage),
              anyLabel: t(MEDICAL_KEYS.filters.all),
              options: Object.fromEntries(
                PURCHASE_STAGES.map((stage) => [
                  stage,
                  { label: t(keys.stages[stage]), tone: PURCHASE_STAGE_TONES[stage] },
                ]),
              ),
            },
          },
        }}
      />
      <MedicalTable
        tab="purchases"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(MEDICAL_KEYS.empty.store)}
        emptyAction={
          canCreate
            ? {
                label: t(MEDICAL_KEYS.create.purchaseOrder),
                onSelect: () => nav.create('purchases'),
              }
            : undefined
        }
        recordsLabel={t(keys.records)}
        countLabel={summary ? t(keys.count, { count: summary.total }) : undefined}
        minWidth={1030}
        onRowClick={open}
        rowTone={(order) => PURCHASE_STAGE_TONES[order.stage]}
        rowActions={rowActions}
        exportName="purchase-orders.csv"
      />
      <Outlet />
    </section>
  );
}
