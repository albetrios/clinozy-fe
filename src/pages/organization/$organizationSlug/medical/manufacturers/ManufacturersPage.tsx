import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  automaticSection,
  roomFiltersOf,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { PenLine, Trash } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { validateMedicalSearch } from '../medical.search.ts';
import { ManufacturerDrawer } from '../shared/components/ManufacturerDrawer/index.ts';
import {
  MedicalDeleteConfirm,
  type MedicalDeleteTarget,
} from '../shared/components/MedicalDeleteConfirm/index.ts';
import { MedicalStackHost } from '../shared/components/MedicalStackHost/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { useMedicalDialogRoute } from '../shared/hooks/useMedicalDialogRoute/index.ts';
import {
  useManufacturerList,
  useMedicalSummary,
  useMrCatalogue,
  useSupplierCatalogue,
} from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import { useMedicalStack } from '../shared/hooks/useMedicalStack/index.ts';
import { fetchManufacturer, medicalQueryKeys } from '../shared/medical-api.ts';
import type { ManufacturerRow } from '../shared/medical-contracts.ts';
import { MEDICAL_DRAWER_KEYS } from '../shared/medical-drawers.constants.ts';
import { useManufacturerColumns } from './hooks/useManufacturerColumns/index.ts';
import { manufacturerFilterKey, manufacturerParamsOf } from './manufacturers.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.manufacturers;

/**
 * Medical › Manufacturers (KICKOFF §6.7; `medical.md:89–103`): the Medical
 * toolbar over the brands on the pack — each with its medicines, who
 * distributes it (grey) and who represents it (mint). A row opens Edit
 * manufacturer; Delete, only while no medicine names it, asks for a reason;
 * the row edge is the maker's own tone. This page opens the Manufacturer
 * drawer for the `create/` and `$manufacturerId/edit/` routes.
 */
export function ManufacturersPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = manufacturerParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const suppliers = useSupplierCatalogue().data ?? [];
  const mrs = useMrCatalogue().data ?? [];
  const { fields, copy } = roomFiltersOf({
    suppliers: automaticSection(t(MEDICAL_KEYS.filters.suppliers), suppliers),
    mrs: automaticSection(t(MEDICAL_KEYS.filters.mrs), mrs),
  });
  const filters = useRoomFilters(fields);
  const stack = useMedicalStack();
  const [deleting, setDeleting] = useState<MedicalDeleteTarget | null>(null);
  const { dialog, close } = useMedicalDialogRoute({
    tab: 'manufacturers',
    param: 'manufacturerId',
    queryKey: medicalQueryKeys.manufacturer,
    fetchRecord: fetchManufacturer,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.manufacturer),
  });

  const list = useManufacturerList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, manufacturerFilterKey(params));
  const summary = useMedicalSummary('manufacturers', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useManufacturerColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const canDelete = access.isResolved && access.can('medical', 'delete');
  const keys = MEDICAL_KEYS.manufacturers;

  const rowActions = (maker: ManufacturerRow): DataTableRowAction[] => [
    {
      id: 'edit',
      label: t(keys.rowActions.edit),
      icon: PenLine,
      onSelect: () => nav.manufacturerEdit(maker.id),
    },
    // Only while no medicine names it (`medical.md:100`).
    ...(canDelete && maker.medicineCount === 0
      ? [
          {
            id: 'delete',
            label: t(keys.rowActions.delete),
            icon: Trash,
            destructive: true,
            onSelect: () =>
              setDeleting({ kind: 'manufacturer', id: maker.id, name: maker.name }),
          },
        ]
      : []),
  ];

  return (
    <section
      data-testid="medical-manufacturers-page"
      className="flex min-h-0 flex-1 flex-col"
    >
      <MedicalToolbar tab="manufacturers" table={table} filters={{ fields, copy }} />
      <MedicalTable
        tab="manufacturers"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(keys.empty)}
        recordsLabel={t(keys.records)}
        countLabel={summary ? t(keys.count, { count: summary.total }) : undefined}
        minWidth={930}
        onRowClick={(maker) => nav.manufacturerEdit(maker.id)}
        rowTone={(maker) => maker.tone}
        rowActions={rowActions}
        exportName="manufacturers.csv"
      />
      <ManufacturerDrawer
        {...(dialog.kind === 'record'
          ? { mode: 'edit' as const, manufacturer: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create' ? { name: dialog.prefill.name } : undefined,
            })}
        open={dialog.kind !== 'none'}
        onClose={close}
        openChild={stack.open}
      />
      <MedicalStackHost stack={stack} />
      <MedicalDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <Outlet />
    </section>
  );
}
