import { type ColumnDef, useTable } from '@tanstack/react-table';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  updatedAt: string;
}

const ROWS: Row[] = [
  {
    id: 'a',
    name: 'Facial',
    phone: '+911',
    price: 1500,
    status: 'active',
    updatedAt: '2026-10-17T14:23:49.904Z',
  },
  {
    id: 'b',
    name: 'Peel, back',
    phone: '+912',
    price: 3000,
    status: 'inactive',
    updatedAt: '2026-10-17T14:27:00.000Z',
  },
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
    accessorKey: 'updatedAt',
    header: 'Updated',
    meta: { foldValue: () => null },
  },
];

function useTestTable(columns = COLUMNS) {
  return useTable({
    features: dataTableFeatures,
    data: ROWS,
    columns,
    getRowId: (row) => row.id,
    state: { columnVisibility: { hidden: false } },
  });
}

describe('exportTableCsv', () => {
  beforeEach(() => csv.downloadCsv.mockReset());

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
        'Facial · a,₹1500,active,2026-10-17T14:23:49.904Z',
        '"Peel, back · b",₹3000,inactive,2026-10-17T14:27:00.000Z',
      ].join('\n'),
    );
  });

  it('falls back to the accessor value without an override', () => {
    csv.downloadCsv.mockReset();
    const { result } = renderHook(() => useTestTable());
    exportTableCsv({ table: result.current, rows: ROWS.slice(0, 1), fileName: 'x.csv' });
    expect(csv.downloadCsv).toHaveBeenCalledWith(
      'x.csv',
      'Offering,Price,State,Updated\nFacial,₹1500,active,2026-10-17T14:23:49.904Z',
    );
  });

  it('uses CSV formatters before folded text and lets the caller override them', () => {
    const { result } = renderHook(() =>
      useTestTable([
        {
          id: 'price',
          accessorKey: 'price',
          header: 'Price',
          meta: {
            foldValue: () => 'display price',
            exportValue: () => 0,
          },
        },
        {
          id: 'status',
          accessorKey: 'status',
          header: 'Status',
          meta: {
            exportValue: () => 'exported status',
          },
        },
      ]),
    );
    exportTableCsv({ table: result.current, rows: ROWS.slice(0, 1), fileName: 'x.csv' });
    expect(csv.downloadCsv).toHaveBeenLastCalledWith(
      'x.csv',
      'Price,Status\n0,exported status',
    );
    exportTableCsv({
      table: result.current,
      rows: ROWS.slice(0, 1),
      fileName: 'x.csv',
      cell: () => 'caller value',
    });
    expect(csv.downloadCsv).toHaveBeenLastCalledWith(
      'x.csv',
      'Price,Status\ncaller value,caller value',
    );
  });

  it('supports intentional blanks and leaves display-only columns empty', () => {
    const { result } = renderHook(() =>
      useTestTable([
        {
          id: 'name',
          accessorKey: 'name',
          header: 'Name',
          meta: {
            foldValue: () => 'visible name',
            exportValue: () => null,
          },
        },
        {
          id: 'price',
          accessorKey: 'price',
          header: 'Price',
          meta: {
            exportValue: () => '',
          },
        },
        { id: 'actions', header: 'Actions', meta: { foldValue: () => null } },
      ]),
    );
    exportTableCsv({ table: result.current, rows: ROWS.slice(0, 1), fileName: 'x.csv' });
    expect(csv.downloadCsv).toHaveBeenLastCalledWith('x.csv', 'Name,Price,Actions\n,,');
  });

  it('falls through undefined CSV formatters to folded text or accessor values', () => {
    const { result } = renderHook(() =>
      useTestTable([
        {
          id: 'price',
          accessorKey: 'price',
          header: 'Price',
          meta: {
            exportValue: () => undefined,
            foldValue: () => 'formatted price',
          },
        },
        {
          id: 'updated',
          accessorKey: 'updatedAt',
          header: 'Updated',
          meta: {
            exportValue: () => undefined,
            foldValue: () => null,
          },
        },
      ]),
    );
    exportTableCsv({ table: result.current, rows: ROWS.slice(0, 1), fileName: 'x.csv' });
    expect(csv.downloadCsv).toHaveBeenLastCalledWith(
      'x.csv',
      'Price,Updated\nformatted price,2026-10-17T14:23:49.904Z',
    );
  });
});
