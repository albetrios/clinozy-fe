import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { TEAM, treatmentRecord } from '../../__tests__/integration/treatment-doubles.ts';
import { useTreatmentsTable } from './useTreatmentsTable.tsx';

vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchTeamDirectory: vi.fn(async () => TEAM),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => TEAM[0]?.id ?? null),
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The session with its latest check-in, "Better · 7/10". */
const LHR = treatmentRecord({
  latestCheckIn: {
    id: 'chk_one00000000000000000',
    date: '2026-10-02',
    feel: 'better',
    score: 7,
  },
});
const rows = [LHR];
const lhr = (changes: Partial<TreatmentRecord> = {}): TreatmentRecord => ({
  ...LHR,
  ...changes,
});

beforeEach(() => {
  signInTestMember();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
});

describe('useTreatmentsTable (H:4754)', () => {
  it('lays out Treatment · Area · Team · Session · Details · Feedback · Date, Team and Details hidden', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows), { wrapper });
    const table = result.current;
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual([
      'treatment',
      'area',
      'team',
      'session',
      'details',
      'feedback',
      'date',
    ]);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      'treatment',
      'area',
      'session',
      'feedback',
      'date',
    ]);
    expect(table.getColumn('treatment')?.columnDef.meta?.primary).toBe(true);
  });

  it('reads the areas, the session and the server’s latest check-in', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows), { wrapper });
    const column = (id: string) => result.current.getColumn(id);
    expect(column('area')?.accessorFn?.(lhr(), 0)).toBe('Face');
    expect(column('session')?.columnDef.meta?.foldValue?.(lhr())).toMatchObject({
      value: '#1',
    });
    expect(column('feedback')?.accessorFn?.(lhr(), 0)).toBe('Better · 7/10');
    expect(column('feedback')?.columnDef.meta?.foldValue?.(lhr())).toMatchObject({
      value: 'Better · 7/10',
      dotClassName: expect.stringMatching(/^bg-tone-mint/),
    });
    expect(column('team')?.columnDef.meta?.foldValue?.(lhr())).toBeNull();
  });

  it('owes the call before any check-in: "Call next day", "Call in 2 days", else "—"', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows), { wrapper });
    const feedback = (treatment: TreatmentRecord) =>
      result.current.getColumn('feedback')?.accessorFn?.(treatment, 0);
    const owed = (aftercareCall: TreatmentRecord['aftercareCall']) =>
      lhr({ aftercareCall, latestCheckIn: null });
    expect(feedback(owed('next_day'))).toBe('Call next day');
    expect(feedback(owed('in_two_days'))).toBe('Call in 2 days');
    expect(feedback(owed('in_week'))).toBe('Call in 7 days');
    expect(feedback(owed('none'))).toBe('—');
    expect(
      result.current.getColumn('feedback')?.columnDef.meta?.foldValue?.(owed('none')),
    ).toBeNull();
  });

  it('marks a reversed session, its reason on hover', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows), { wrapper });
    const reversed = lhr({ status: 'reversed', reversedReason: 'Wrong patient' });
    // The copy is new (locales-C.json); the test bundle still holds the key.
    expect(result.current.getColumn('feedback')?.accessorFn?.(reversed, 0)).toMatch(
      /Reversed|treatment\.reverse\.status/,
    );
    expect(
      result.current.getColumn('feedback')?.columnDef.meta?.foldValue?.(reversed),
    ).toMatchObject({ dotClassName: expect.stringMatching(/^bg-tone-blush/) });
  });

  it('names a dental treatment’s teeth as its area, and its other values as details', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows), { wrapper });
    const dental = lhr({
      template: 'dental',
      parameters: { procedure: 'Filling', teeth: '1112', material: 'Composite' },
    });
    expect(result.current.getColumn('area')?.accessorFn?.(dental, 0)).toBe('#11, #12');
    expect(result.current.getColumn('details')?.accessorFn?.(dental, 0)).toBe(
      'Filling · Composite',
    );
    const bare = lhr({ template: 'general', parameters: {}, bodyParts: [] });
    expect(result.current.getColumn('area')?.accessorFn?.(bare, 0)).toBe('');
    expect(result.current.getColumn('details')?.accessorFn?.(bare, 0)).toBe('—');
    expect(
      result.current.getColumn('area')?.columnDef.meta?.foldValue?.(bare),
    ).toBeNull();
  });
});
