import type { RowData } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { tableEntries } from './data-table-groups.ts';
import type { TableRow } from './data-table-layout.ts';

interface Visit {
  id: string;
  day: string;
}

/** Just enough of a TanStack row for the grouping: its id and its record. */
function rowsOf<TData extends RowData & { id: string }>(
  data: TData[],
): TableRow<TData>[] {
  return data.map((original) => ({ id: original.id, original }) as TableRow<TData>);
}

const visits = rowsOf<Visit>([
  { id: 'a', day: '2026-10-03' },
  { id: 'b', day: '2026-10-03' },
  { id: 'c', day: '2026-10-04' },
  { id: 'd', day: '2026-10-06' },
]);

describe('tableEntries', () => {
  it('is one entry per row without a group key', () => {
    const body = tableEntries(visits);
    expect(body.entries.map((entry) => entry.kind)).toEqual(['row', 'row', 'row', 'row']);
    expect(body.entryOfRow).toEqual([0, 1, 2, 3]);
    expect(body.groupOfEntry).toEqual([-1, -1, -1, -1]);
  });

  it('puts a header before each run of rows sharing a key', () => {
    const body = tableEntries(visits, (visit) => visit.day);
    expect(
      body.entries.map((entry) => (entry.kind === 'group' ? entry.key : entry.id)),
    ).toEqual(['2026-10-03', 'a', 'b', '2026-10-04', 'c', '2026-10-06', 'd']);
    const groups = body.entries.filter((entry) => entry.kind === 'group');
    expect(groups.map((group) => group.rows.map((row) => row.id))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
    ]);
    expect(groups.map((group) => group.groupIndex)).toEqual([0, 1, 2]);
  });

  it('maps each row to its entry and each entry to its group header', () => {
    const body = tableEntries(visits, (visit) => visit.day);
    expect(body.entryOfRow).toEqual([1, 2, 4, 6]);
    expect(body.groupOfEntry).toEqual([0, 0, 0, 3, 3, 5, 5]);
  });

  it('keeps row indices for selection and j / k', () => {
    const body = tableEntries(visits, (visit) => visit.day);
    const rows = body.entries.flatMap((entry) =>
      entry.kind === 'row' ? [entry.rowIndex] : [],
    );
    expect(rows).toEqual([0, 1, 2, 3]);
  });

  it('heads a key again when it comes back out of order, with unique ids', () => {
    const body = tableEntries(
      rowsOf<Visit>([
        { id: 'a', day: '2026-10-03' },
        { id: 'b', day: '2026-10-04' },
        { id: 'c', day: '2026-10-03' },
      ]),
      (visit) => visit.day,
    );
    const ids = body.entries.filter((entry) => entry.kind === 'group').map((g) => g.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });
});
