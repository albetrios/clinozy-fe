import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import { NamePills } from '../../../shared/components/MedicalCells/index.ts';
import type { ManufacturerRow } from '../../../shared/medical-contracts.ts';

const rowOf = (original: unknown) => original as ManufacturerRow;

/**
 * The Manufacturers columns (KICKOFF §6.7 Tables; `medical.md:93–100`):
 * Manufacturer · Medicines · Suppliers · MRs — tracks `minmax(200px,1.1fr)
 * 120px minmax(200px,1.3fr) minmax(180px,1.2fr)`. On a phone the maker's pill
 * leads, "1 medicine" is the key and the meta line reads Suppliers, MRs.
 */
export function useManufacturerColumns(): ColumnDef<
  DataTableFeatures,
  ManufacturerRow
>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const keys = MEDICAL_KEYS.manufacturers;
  const medicines = (maker: ManufacturerRow) =>
    maker.medicineCount > 0
      ? t(keys.medicines, { count: maker.medicineCount })
      : t(keys.noMedicines);

  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: t(keys.columns.name),
      enableHiding: false,
      cell: ({ row }) => (
        <TonePill tone={row.original.tone}>{row.original.name}</TonePill>
      ),
      meta: {
        track: 'minmax(200px,1.1fr)',
        kind: 'badges',
        primary: true,
        foldValue: (original) => {
          const maker = rowOf(original);
          return { value: maker.name, dotClassName: TONE_CLASSES[maker.tone].fill };
        },
      },
    },
    {
      id: 'medicines',
      accessorKey: 'medicineCount',
      header: t(keys.columns.medicines),
      enableSorting: false,
      cell: ({ row }) => (
        <span
          className={
            row.original.medicineCount > 0 ? 'truncate' : 'text-muted-foreground truncate'
          }
        >
          {medicines(row.original)}
        </span>
      ),
      meta: { track: '120px', foldValue: (original) => medicines(rowOf(original)) },
    },
    {
      id: 'suppliers',
      accessorFn: (maker) => maker.suppliers.map((supplier) => supplier.name),
      header: t(keys.columns.suppliers),
      enableSorting: false,
      cell: ({ row }) => <NamePills names={row.original.suppliers} />,
      meta: { track: 'minmax(200px,1.3fr)', kind: 'badges' },
    },
    {
      id: 'mrs',
      accessorFn: (maker) => maker.mrs.map((mr) => mr.name),
      header: t(keys.columns.mrs),
      enableSorting: false,
      cell: ({ row }) => <NamePills names={row.original.mrs} tone="mint" />,
      meta: { track: 'minmax(180px,1.2fr)', kind: 'badges' },
    },
  ];
}
