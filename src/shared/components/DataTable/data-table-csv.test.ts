import { type ColumnDef, useTable } from '@tanstack/react-table';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { exportTableCsv } from './data-table-csv.ts';
import { type DataTableFeatures, dataTableFeatures } from './table-features.ts';

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: csv.downloadCsv,
}));

interface Row {
  id: string;
  name: string;
  phone: string;
  price: number;
  status: 'active' | 'inactive';
}

const ROWS: Row[] = [
  { id: 'a', name: 'Facial', phone: '+911', price: 1500, status: 'active' },
  { id: 'b', name: 'Peel, back', phone: '+912', price: 3000, status: 'inactive' },
];

const COLUMNS: ColumnDef<DataTableFeatures, Row>[] = [
  { id: 'name', accessorKey: 'name', header: 'Offering' },
  {
    id: 'price',
    accessorKey: 'price',
    header: 'Price',
    meta: { foldValue: (row) => `₹${(row as Row).price}` },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    meta: { label: 'State', foldValue: (row) => ({ value: (row as Row).status }) },
  },
  { id: 'hidden', accessorKey: 'phone', header: 'Phone' },
  {
    id: 'updated',
    accessorKey: 'id',
    header: 'Updated',
    meta: { foldValue: () => null },
  },
];

function useTestTable() {
  return useTable({
    features: dataTableFeatures,
    data: ROWS,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    state: { columnVisibility: { hidden: false } },
  });
}

describe('exportTableCsv', () => {
  it('writes the visible columns: labels, meta-line values, accessor values, overrides', () => {
    const { result } = renderHook(() => useTestTable());
    exportTableCsv({
      table: result.current,
      rows: ROWS,
      fileName: 'offerings.csv',
      cell: (columnId, row) =>
        columnId === 'name' ? `${row.name} · ${row.id}` : undefined,
    });
    expect(csv.downloadCsv).toHaveBeenCalledWith(
      'offerings.csv',
      [
        'Offering,Price,State,Updated',
        'Facial · a,₹1500,active,',
        '"Peel, back · b",₹3000,inactive,',
      ].join('\n'),
    );
  });

  it('falls back to the accessor value without an override', () => {
    csv.downloadCsv.mockReset();
    const { result } = renderHook(() => useTestTable());
    exportTableCsv({ table: result.current, rows: ROWS.slice(0, 1), fileName: 'x.csv' });
    expect(csv.downloadCsv).toHaveBeenCalledWith(
      'x.csv',
      'Offering,Price,State,Updated\nFacial,₹1500,active,',
    );
  });
});
