import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  automaticSection,
  roomFiltersOf,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePayBill } from '@/shared/hooks/usePayBill/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { Package, PenLine, Trash, Wallet } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { validateMedicalSearch } from '../medical.search.ts';
import {
  MedicalDeleteConfirm,
  type MedicalDeleteTarget,
} from '../shared/components/MedicalDeleteConfirm/index.ts';
import { MedicalStackHost } from '../shared/components/MedicalStackHost/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { SupplierDrawer } from '../shared/components/SupplierDrawer/index.ts';
import { useMedicalDialogRoute } from '../shared/hooks/useMedicalDialogRoute/index.ts';
import {
  useManufacturerCatalogue,
  useMedicalSummary,
  useSupplierList,
} from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import { useMedicalStack } from '../shared/hooks/useMedicalStack/index.ts';
import { fetchSupplier, medicalQueryKeys } from '../shared/medical-api.ts';
import type { SupplierRow } from '../shared/medical-contracts.ts';
import { MEDICAL_DRAWER_KEYS } from '../shared/medical-drawers.constants.ts';
import { supplierAgeingTone } from '../shared/medical-tones.ts';
import { useSupplierColumns } from './hooks/useSupplierColumns/index.ts';
import { supplierFilterKey, supplierParamsOf } from './suppliers.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.suppliers;

/**
 * Medical › Suppliers (KICKOFF §6.7; `medical.md:73–87`): the Medical toolbar
 * over the suppliers — a row opens Edit supplier; "Pay ₹827", while something
 * is due, opens Payments › Send payment on its oldest open bill (Q-M1); "New
 * purchase order" opens one on that supplier; Delete, with nothing due and no
 * order to settle, asks for a reason. The footer counts the suppliers and what they are owed; the
 * row edge shows how long while money is due. This page opens the Supplier
 * drawer for the `create/` and `$supplierId/edit/` routes.
 */
export function SuppliersPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = supplierParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const formatPaise = usePaiseFormat();
  const makers = useManufacturerCatalogue().data ?? [];
  const { fields, copy } = roomFiltersOf({
    manufacturer: automaticSection(t(MEDICAL_KEYS.filters.manufacturers), makers),
  });
  const filters = useRoomFilters(fields);
  const stack = useMedicalStack();
  const { canPay, pay } = usePayBill();
  const [deleting, setDeleting] = useState<MedicalDeleteTarget | null>(null);
  const { dialog, close } = useMedicalDialogRoute({
    tab: 'suppliers',
    param: 'supplierId',
    queryKey: medicalQueryKeys.supplier,
    fetchRecord: fetchSupplier,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.supplier),
  });

  const list = useSupplierList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, supplierFilterKey(params));
  const summary = useMedicalSummary('suppliers', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useSupplierColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const canCreate = access.isResolved && access.can('medical', 'create');
  const canDelete = access.isResolved && access.can('medical', 'delete');
  const keys = MEDICAL_KEYS.suppliers;

  /** Send payment on the supplier's oldest open bill — "Add & another" walks the rest (AMBER). */
  const paySupplier = (supplier: SupplierRow) => {
    if (supplier.oldestOpenBill) {
      pay({ kind: 'medical_po', purchaseId: supplier.oldestOpenBill.id });
    }
  };

  const rowActions = (supplier: SupplierRow): DataTableRowAction[] => [
    ...(canPay && supplier.payable > 0 && supplier.oldestOpenBill
      ? [
          {
            id: 'pay',
            label: t(keys.rowActions.pay, { amount: formatPaise(supplier.payable) }),
            icon: Wallet,
            onSelect: () => paySupplier(supplier),
          },
        ]
      : []),
    ...(canCreate
      ? [
          {
            id: 'new-order',
            label: t(keys.rowActions.newOrder),
            icon: Package,
            onSelect: () => nav.create('purchases', { supplier: supplier.id }),
          },
        ]
      : []),
    {
      id: 'edit',
      label: t(keys.rowActions.edit),
      icon: PenLine,
      onSelect: () => nav.supplierEdit(supplier.id),
    },
    // Only with nothing due and no order left to settle (`medical.md:84`).
    ...(canDelete && supplier.payable === 0 && !supplier.hasOpenOrder
      ? [
          {
            id: 'delete',
            label: t(keys.rowActions.delete),
            icon: Trash,
            destructive: true,
            onSelect: () =>
              setDeleting({ kind: 'supplier', id: supplier.id, name: supplier.name }),
          },
        ]
      : []),
  ];

  return (
    <section
      data-testid="medical-suppliers-page"
      className="flex min-h-0 flex-1 flex-col"
    >
      <MedicalToolbar tab="suppliers" table={table} filters={{ fields, copy }} />
      <MedicalTable
        tab="suppliers"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(keys.empty)}
        emptyAction={
          canCreate
            ? {
                label: t(MEDICAL_KEYS.create.supplier),
                onSelect: () => nav.create('suppliers'),
              }
            : undefined
        }
        recordsLabel={t(keys.records)}
        countLabel={
          summary
            ? t(keys.count, {
                count: summary.total,
                payable: formatPaise(summary.payable),
              })
            : undefined
        }
        minWidth={980}
        onRowClick={(supplier) => nav.supplierEdit(supplier.id)}
        rowTone={(supplier) =>
          supplier.ageingDays === null
            ? undefined
            : supplierAgeingTone(supplier.ageingDays)
        }
        rowActions={rowActions}
        exportName="suppliers.csv"
        avatar
      />
      <SupplierDrawer
        {...(dialog.kind === 'record'
          ? { mode: 'edit' as const, supplier: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create' ? { name: dialog.prefill.name } : undefined,
            })}
        open={dialog.kind !== 'none'}
        onClose={close}
        openChild={stack.open}
        onNewOrder={(supplierId) => nav.create('purchases', { supplier: supplierId })}
        onPay={canPay ? paySupplier : undefined}
      />
      <MedicalStackHost stack={stack} />
      <MedicalDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <Outlet />
    </section>
  );
}
