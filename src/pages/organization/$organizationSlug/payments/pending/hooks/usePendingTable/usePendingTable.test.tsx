import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { creditRow } from '@/tests/utils/payments-doubles.ts';

import { pendingRowTone, usePendingTable } from './usePendingTable.tsx';

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');

/** Newest first, as the API answers: a supplier's Take, then Kavya's CR-1. */
const ROWS = [
  creditRow({
    id: 'pcr_supplier0000000000007',
    seq: 7,
    direction: 'take',
    contactId: null,
    contact: null,
    patientId: null,
    partyName: 'Medline Surgicals',
    amount: 800,
    settled: 0,
    left: 800,
    reason: 'damaged_goods',
    reasonKey: 'damaged_goods',
    by: null,
  }),
  creditRow(),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useDevicePrefsStore.setState({ hiddenColumns: {} });
});
afterEach(() => vi.useRealTimers());

describe('usePendingTable (payments.md:45–46)', () => {
  it('lays out Ref · Who · Which way · Amount · Why · Since · State · By, Who the meta line', () => {
    const { result } = renderHook(() => usePendingTable(ROWS));
    const columns = result.current.getAllLeafColumns();
    expect(columns.map((column) => column.id)).toEqual([
      'ref',
      'who',
      'way',
      'amount',
      'why',
      'since',
      'state',
      'by',
    ]);
    expect(columns.every((column) => !column.getCanSort())).toBe(true);
    expect(result.current.getColumn('ref')?.getCanHide()).toBe(false);
    expect(result.current.getColumn('who')?.columnDef.meta?.primary).toBe(true);
    const drawsAvatar = result.current.getColumn('who')?.columnDef.meta?.drawsAvatar;
    expect(drawsAvatar?.(ROWS[1])).toBe(true);
    expect(drawsAvatar?.(ROWS[0])).toBe(false);
    expect(result.current.getColumn('amount')?.columnDef.meta).toMatchObject({
      align: 'end',
    });
    expect(result.current.getRowModel().rows.map((row) => row.original.seq)).toEqual([
      7, 1,
    ]);
  });

  it('folds each column to its meta-line value — By to nothing', () => {
    const { result } = renderHook(() => usePendingTable(ROWS));
    const fold = (id: string) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(ROWS[1]);
    expect(fold('ref')).toBe('CR-1');
    expect(fold('way')).toMatchObject({
      value: 'Give',
      dotClassName: expect.stringContaining('bg-tone-blush-foreground'),
    });
    expect(fold('amount')).toBe('₹80');
    expect(fold('why')).toBe('Overpaid');
    expect(fold('since')).toBe('Oct 10');
    expect(fold('state')).toMatchObject({ value: 'Open' });
    expect(fold('by')).toBeNull();
  });

  it('edges an open credit in its way’s tone, a settled one grey', () => {
    expect(pendingRowTone({ status: 'open', direction: 'give' })).toBe('blush');
    expect(pendingRowTone({ status: 'open', direction: 'take' })).toBe('sky');
    expect(pendingRowTone({ status: 'used', direction: 'give' })).toBe('stone');
  });
});
