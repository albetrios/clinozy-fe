import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { useRoomTable } from './useRoomTable.ts';

interface Row {
  id: string;
  name: string;
  note: string;
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name' as const, header: 'Name' },
  {
    id: 'note',
    accessorKey: 'note' as const,
    header: 'Note',
    meta: { defaultHidden: true },
  },
];

beforeEach(() => {
  useDevicePrefsStore.setState({ hiddenColumns: {} });
});

describe('useRoomTable', () => {
  it('keys rows by id, hides the recommended set and writes sorts to the URL', () => {
    const onSortChange = vi.fn();
    const { result } = renderHook(() =>
      useRoomTable<Row>({
        tableId: 'room-table-test',
        columns: COLUMNS,
        rows: [{ id: 'r1', name: 'A', note: 'n' }],
        sort: 'name:desc',
        onSortChange,
      }),
    );
    const table = result.current;
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(['r1']);
    expect(table.getColumn('note')?.getIsVisible()).toBe(false);
    expect(table.getColumn('name')?.getIsSorted()).toBe('desc');
    act(() => table.getColumn('name')?.toggleSorting(false));
    expect(onSortChange).toHaveBeenCalledWith('name:asc');
  });
});
