import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { addCivilDays, appToday } from '@/shared/api/app/app-time.ts';

import type { MrRow } from '../../../shared/medical-contracts.ts';
import { mrInitials, useMrColumns } from './useMrColumns.tsx';

const rep = (nextVisitOn: string | null) =>
  ({
    id: 'r1',
    name: 'Alvio Pharma · Rakesh',
    phone: null,
    manufacturers: [],
    nextVisitOn,
    lastVisitOn: null,
    samples: null,
  }) as unknown as MrRow;

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

  it('tones the next visit blush once it is past, against today', () => {
    const { result } = renderHook(() => useMrColumns());
    const fold = (row: MrRow) =>
      result.current.find((column) => column.id === 'nextVisit')?.meta?.foldValue?.(row);
    expect(fold(rep(addCivilDays(appToday(), -1)))).toMatchObject({
      dotClassName: 'bg-tone-blush-foreground text-background',
    });
    expect(fold(rep(addCivilDays(appToday(), 3)))).toMatchObject({
      dotClassName: 'bg-tone-sky-foreground text-background',
    });
    expect(fold(rep(null))).toBeNull();
  });

  it('takes the rep’s initials from their own name', () => {
    expect(mrInitials('Alvio Pharma · Rakesh')).toBe('RA');
    expect(mrInitials('Ravi')).toBe('RA');
  });
});
