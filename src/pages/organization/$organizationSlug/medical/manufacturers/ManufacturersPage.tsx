import { Outlet, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useRoomFilters } from '@/shared/components/RoomToolbar/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { PenLine } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { validateMedicalSearch } from '../medical.search.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import {
  useManufacturerList,
  useMedicalSummary,
  useMrCatalogue,
  useSupplierCatalogue,
} from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import { filtersOf, recordSection } from '../shared/medical-filters.ts';
import { useManufacturerColumns } from './hooks/useManufacturerColumns/index.ts';
import { manufacturerFilterKey, manufacturerParamsOf } from './manufacturers.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.manufacturers;

/**
 * Medical › Manufacturers (KICKOFF §6.7; `medical.md:89–103`): the Medical
 * toolbar over the brands on the pack — each with its medicines, who
 * distributes it (grey) and who represents it (mint). A row opens Edit
 * manufacturer; the row edge is the maker's own tone.
 */
export function ManufacturersPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = manufacturerParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const suppliers = useSupplierCatalogue().data ?? [];
  const mrs = useMrCatalogue().data ?? [];
  const { fields, copy } = filtersOf({
    suppliers: recordSection(t(MEDICAL_KEYS.filters.suppliers), suppliers),
    mrs: recordSection(t(MEDICAL_KEYS.filters.mrs), mrs),
  });
  const filters = useRoomFilters(fields);

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

  const canCreate = access.isResolved && access.can('medical', 'create');
  const keys = MEDICAL_KEYS.manufacturers;

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
        emptyAction={
          canCreate
            ? {
                label: t(MEDICAL_KEYS.create.manufacturer),
                onSelect: () => nav.create('manufacturers'),
              }
            : undefined
        }
        recordsLabel={t(keys.records)}
        countLabel={summary ? t(keys.count, { count: summary.total }) : undefined}
        minWidth={930}
        onRowClick={(maker) => nav.manufacturerEdit(maker.id)}
        rowTone={(maker) => maker.tone}
        rowActions={(maker) => [
          {
            id: 'edit',
            label: t(keys.rowActions.edit),
            icon: PenLine,
            onSelect: () => nav.manufacturerEdit(maker.id),
          },
        ]}
        exportName="manufacturers.csv"
      />
      <Outlet />
    </section>
  );
}
