import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  planFold,
  rowActionsWidth,
} from '@/shared/components/DataTable/data-table-fold.ts';
import { toFoldColumn } from '@/shared/components/DataTable/data-table-layout.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

import { offeringRows } from '../../offerings.rows.ts';
import { useOfferingsTable } from './useOfferingsTable.tsx';

/** The table card's inner width at a viewport: compact margins 12px a side, 1px borders. */
const scrollerAt = (viewport: number) => viewport - 2 * 12 - 2;
/** Comfortable margins 20px a side at 1440. */
const DESKTOP_SCROLLER = 1440 - 2 * 20 - 2;

function useTable() {
  return useOfferingsTable({
    rows: [],
    sort: undefined,
    onSortChange: vi.fn(),
    catalogue: { branches: [] },
  });
}

/** The visible columns plus the Edit │ Delete actions track (107px, H:4119). */
function foldColumns(table: ReturnType<typeof useTable>) {
  const actions = rowActionsWidth({ inline: 2, separator: true, menu: false }, 32);
  expect(actions).toBe(107);
  return [
    ...table.getVisibleLeafColumns().map(toFoldColumn),
    { id: '__actions', label: '', track: `${actions}px`, kind: 'actions' as const },
  ];
}

describe('useOfferingsTable (KICKOFF §6.11 Offerings tab)', () => {
  it('declares the columns in order, Updated hidden by default', () => {
    const { result } = renderHook(() => useTable());
    expect(result.current.getAllLeafColumns().map((column) => column.id)).toEqual([
      'seq',
      'name',
      'category',
      'price',
      'offer',
      'branches',
      'duration',
      'sessions',
      'status',
      'updated',
    ]);
    expect(result.current.getVisibleLeafColumns()).toHaveLength(9);
    expect(result.current.getColumn('offer')?.getCanSort()).toBe(false);
    expect(result.current.getColumn('branches')?.getCanSort()).toBe(false);
    expect(result.current.getColumn('price')?.getCanSort()).toBe(true);
    expect(result.current.getColumn('seq')?.getCanHide()).toBe(false);
  });

  it('folds 6 columns at 820px (keeps Offering · Category · Price) and 4 at 1024px', () => {
    const { result } = renderHook(() => useTable());
    const columns = foldColumns(result.current);
    const at820 = planFold(columns, scrollerAt(820));
    expect(at820.folded).toHaveLength(6);
    expect(at820.kept).toEqual(['name', 'category', 'price', '__actions']);
    const at1024 = planFold(columns, scrollerAt(1024));
    expect(at1024.folded).toEqual(['seq', 'duration', 'sessions', 'status']);
    expect(at1024.kept).toEqual([
      'name',
      'category',
      'price',
      'offer',
      'branches',
      '__actions',
    ]);
    expect(planFold(columns, DESKTOP_SCROLLER).folded).toHaveLength(0);
  });

  it('reads the live record: the ID from `offering_number`, a product’s duration as none, the time it was saved', () => {
    const rows = offeringRows(
      [
        offeringRecord({ offeringNumber: 12 }),
        offeringRecord({
          id: 'off_sunscreenspffifty0004',
          offeringNumber: 4,
          category: 'product',
          isActive: false,
          updatedAt: '2026-09-24T09:20:00.000Z',
        }),
      ],
      [],
      { branchId: null, openBranchIds: [] },
    );
    const { result } = renderHook(() =>
      useOfferingsTable({
        rows,
        sort: undefined,
        onSortChange: vi.fn(),
        catalogue: { branches: [] },
      }),
    );
    const [peel, sunscreen] = result.current.getRowModel().rows;
    const fold = (row: typeof peel, columnId: string) =>
      result.current.getColumn(columnId)?.columnDef.meta?.foldValue?.(row?.original);
    expect(fold(peel, 'seq')).toBe('#12');
    expect(sunscreen?.getValue('duration')).toBeNull();
    expect(fold(sunscreen, 'duration')).toBe('—');
    expect(sunscreen?.getValue('status')).toBe('inactive');
    expect(fold(sunscreen, 'status')).toMatchObject({ value: 'Inactive' });
    // The Updated column folds to when it was saved — no one is named (G10).
    expect(fold(sunscreen, 'updated')).toMatch(/Sep 24/);
  });

  it('writes the sort to the URL through the header cycle', () => {
    const onSortChange = vi.fn();
    const { result } = renderHook(() =>
      useOfferingsTable({
        rows: [],
        sort: 'price:asc',
        onSortChange,
        catalogue: { branches: [] },
      }),
    );
    expect(result.current.getColumn('price')?.getIsSorted()).toBe('asc');
    result.current.getColumn('price')?.toggleSorting(true);
    expect(onSortChange).toHaveBeenCalledWith('price:desc');
  });
});
