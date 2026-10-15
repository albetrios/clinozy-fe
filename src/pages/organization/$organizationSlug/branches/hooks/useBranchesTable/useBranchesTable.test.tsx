import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Branch } from '@/shared/api/app/app-schema.ts';

import type { BranchRow } from '../useBranchRows/index.ts';
import { useBranchesTable } from './useBranchesTable.tsx';

const ROW: BranchRow = {
  branch: {
    id: 'b-vesu',
    name: 'Vesu',
    tone: 'sky',
    isMain: false,
    active: false,
    addressLine1: 'Shop 12, Rajhans Platinum',
    phone: '',
    email: '',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    opensAt: '11:00',
    closesAt: '20:00',
  } as unknown as Branch,
  team: [],
  defaults: [],
};

describe('useBranchesTable (users.md:83–93)', () => {
  it('lays out Branch · Address · Contact · Opening hours · Team · Default people · Status, none sortable', () => {
    const { result } = renderHook(() => useBranchesTable([ROW]));
    const columns = result.current.getAllLeafColumns();
    expect(columns.map((column) => column.id)).toEqual([
      'branch',
      'address',
      'contact',
      'hours',
      'team',
      'defaults',
      'status',
    ]);
    expect(columns.some((column) => column.getCanSort())).toBe(false);
    expect(result.current.getRowModel().rows[0]?.id).toBe('b-vesu');
  });

  it('folds each column to its words — Team to nothing, an empty phone to "—"', () => {
    const { result } = renderHook(() => useBranchesTable([ROW]));
    const fold = (id: string) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(ROW);
    expect(fold('contact')).toBe('—');
    expect(fold('hours')).toBe('Mon–Sat · 11:00–20:00');
    expect(fold('team')).toBeNull();
    expect(fold('defaults')).toBe('Not set');
    expect(fold('status')).toMatchObject({ value: 'Closed' });
  });
});
