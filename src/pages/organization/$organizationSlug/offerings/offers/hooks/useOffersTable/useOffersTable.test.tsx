import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  pickPhoneKeyColumn,
  planFold,
  rowActionsWidth,
} from '@/shared/components/DataTable/data-table-fold.ts';
import { toFoldColumn } from '@/shared/components/DataTable/data-table-layout.ts';

import { useOffersTable } from './useOffersTable.tsx';

/** The table card's inner width at a viewport: compact margins 12px a side, 1px borders. */
const scrollerAt = (viewport: number) => viewport - 2 * 12 - 2;

function useTable() {
  return useOffersTable({
    rows: [],
    catalogue: { branches: [], savedBy: () => undefined, today: '2026-10-04' },
    nameOf: () => undefined,
  });
}

describe('useOffersTable (KICKOFF §6.11 Offers tab)', () => {
  it('declares the columns in order, Updated hidden, nothing sortable', () => {
    const { result } = renderHook(() => useTable());
    expect(result.current.getAllLeafColumns().map((column) => column.id)).toEqual([
      'offer',
      'type',
      'appliesTo',
      'branches',
      'valid',
      'status',
      'updated',
    ]);
    expect(result.current.getVisibleLeafColumns()).toHaveLength(6);
    expect(result.current.getAllLeafColumns().some((column) => column.getCanSort())).toBe(
      false,
    );
    expect(result.current.getColumn('offer')?.getCanHide()).toBe(false);
  });

  it('folds 4 columns at 820px (keeps Offer · Type) and 2 at 1024px with its three actions', () => {
    const { result } = renderHook(() => useTable());
    // Edit · Pause / Resume │ Delete — 145px (H:4119).
    const actions = rowActionsWidth({ inline: 3, separator: true, menu: false }, 32);
    expect(actions).toBe(145);
    const columns = [
      ...result.current.getVisibleLeafColumns().map(toFoldColumn),
      { id: '__actions', label: '', track: `${actions}px`, kind: 'actions' as const },
    ];
    const at820 = planFold(columns, scrollerAt(820));
    expect(at820.kept).toEqual(['offer', 'type', '__actions']);
    expect(at820.folded).toHaveLength(4);
    const at1024 = planFold(columns, scrollerAt(1024));
    expect(at1024.folded).toEqual(['valid', 'status']);
  });

  it('keys a phone row on Type', () => {
    const { result } = renderHook(() => useTable());
    expect(
      pickPhoneKeyColumn(result.current.getVisibleLeafColumns().map(toFoldColumn)),
    ).toBe('type');
  });
});
