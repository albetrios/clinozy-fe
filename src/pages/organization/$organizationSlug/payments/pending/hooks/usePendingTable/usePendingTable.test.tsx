import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listPendingCredits } from '@/shared/api/clinic/credits-api.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { pendingRowTone, usePendingTable } from './usePendingTable.tsx';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

let rows: CreditRow[] = [];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  rows = [...(await listPendingCredits({})).items];
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('usePendingTable (payments.md:45–46)', () => {
  it('lays out Ref · Who · Which way · Amount · Why · Since · State, Who the meta line', () => {
    const { result } = renderHook(() => usePendingTable(rows));
    const columns = result.current.getAllLeafColumns();
    expect(columns.map((column) => column.id)).toEqual([
      'ref',
      'who',
      'way',
      'amount',
      'why',
      'since',
      'state',
    ]);
    expect(columns.every((column) => !column.getCanSort())).toBe(true);
    expect(result.current.getColumn('ref')?.getCanHide()).toBe(false);
    expect(result.current.getColumn('who')?.columnDef.meta?.primary).toBe(true);
    const drawsAvatar = result.current.getColumn('who')?.columnDef.meta?.drawsAvatar;
    expect(drawsAvatar?.(rows.find((row) => row.seq === 2))).toBe(true);
    expect(drawsAvatar?.(rows.find((row) => row.seq === 1))).toBe(false);
    expect(result.current.getColumn('amount')?.columnDef.meta).toMatchObject({
      align: 'end',
    });
    expect(result.current.getRowModel().rows.map((row) => row.original.seq)).toEqual([
      2, 1,
    ]);
  });

  it('folds each column to its meta-line value', () => {
    const { result } = renderHook(() => usePendingTable(rows));
    const tanvi = rows.find((row) => row.seq === 2);
    const fold = (id: string) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(tanvi);
    expect(fold('ref')).toBe('CR-2');
    expect(fold('way')).toMatchObject({
      value: 'Give',
      dotClassName: expect.stringContaining('bg-tone-blush-foreground'),
    });
    expect(fold('amount')).toBe('₹500');
    expect(fold('why')).toBe('Charged twice for corn removal');
    expect(fold('since')).toBe('Jun 10');
    expect(fold('state')).toMatchObject({ value: 'Open' });
  });

  it('edges an open credit in its way’s tone, a settled one grey', () => {
    expect(pendingRowTone({ status: 'open', direction: 'give' })).toBe('blush');
    expect(pendingRowTone({ status: 'open', direction: 'take' })).toBe('sky');
    expect(pendingRowTone({ status: 'used', direction: 'give' })).toBe('stone');
  });
});
