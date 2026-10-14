import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mrRow } from '@/tests/utils/medical-doubles.ts';

import type { MrRow } from '../../../shared/medical-contracts.ts';
import { mrInitials, useMrColumns } from './useMrColumns.tsx';

describe('useMrColumns', () => {
  it('lays out the MRs columns with Samples hidden', () => {
    const { result } = renderHook(() => useMrColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'name',
      'represents',
      'lastVisit',
      'nextVisit',
      'samples',
    ]);
    expect(result.current.at(-1)?.meta).toMatchObject({ defaultHidden: true });
  });

  it('tones the next visit blush once the server marks it overdue, sky ahead', () => {
    const { result } = renderHook(() => useMrColumns());
    const fold = (row: MrRow) =>
      result.current.find((column) => column.id === 'nextVisit')?.meta?.foldValue?.(row);
    expect(fold(mrRow({ nextVisitOn: '2026-10-01', visitOverdue: true }))).toMatchObject({
      dotClassName: 'bg-tone-blush-foreground text-background',
    });
    expect(fold(mrRow({ visitOverdue: false }))).toMatchObject({
      dotClassName: 'bg-tone-sky-foreground text-background',
    });
    expect(fold(mrRow({ nextVisitOn: null }))).toBeNull();
  });

  it('folds the last visit, or nothing before the first', () => {
    const { result } = renderHook(() => useMrColumns());
    const fold = (row: MrRow) =>
      result.current.find((column) => column.id === 'lastVisit')?.meta?.foldValue?.(row);
    expect(fold(mrRow())).toEqual(expect.any(String));
    expect(fold(mrRow({ lastVisitOn: null }))).toBeNull();
  });

  it('takes the rep’s initials from their own name', () => {
    expect(mrInitials('Alvio Pharma · Rakesh')).toBe('RA');
    expect(mrInitials('Ravi')).toBe('RA');
  });
});
