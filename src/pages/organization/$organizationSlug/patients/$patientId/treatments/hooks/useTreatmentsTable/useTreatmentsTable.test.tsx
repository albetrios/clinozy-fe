import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  listPatientTreatments,
  listTreatmentCheckIns,
  type TreatmentCheckIn,
} from '@/shared/api/clinic/treatments-api.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { useTreatmentsTable } from './useTreatmentsTable.tsx';

let client: QueryClient;
let rows: Treatment[] = [];
let checkIns: Record<string, TreatmentCheckIn> = {};
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const DHARTI = patientRef('Dharti Galani');

beforeEach(async () => {
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rows = await listPatientTreatments(DHARTI);
  checkIns = await listTreatmentCheckIns(DHARTI);
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

/** The first treatment, as another template or call would leave it. */
const lhr = (changes: Partial<Treatment> = {}): Treatment => {
  const [first] = rows;
  if (!first) throw new Error('no treatment');
  return { ...first, ...changes };
};

describe('useTreatmentsTable (H:4754)', () => {
  it('lays out Treatment · Area · Team · Session · Details · Feedback · Date, Team and Details hidden', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows, checkIns), { wrapper });
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

  it('reads the areas, the session and the latest check-in', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows, checkIns), { wrapper });
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
    const { result } = renderHook(() => useTreatmentsTable(rows, {}), { wrapper });
    const feedback = (treatment: Treatment) =>
      result.current.getColumn('feedback')?.accessorFn?.(treatment, 0);
    expect(feedback(lhr({ aftercareCall: 'next_day' }))).toBe('Call next day');
    expect(feedback(lhr({ aftercareCall: 'in_2_days' }))).toBe('Call in 2 days');
    expect(feedback(lhr({ aftercareCall: 'in_week' }))).toBe('Call in 7 days');
    expect(feedback(lhr({ aftercareCall: 'none' }))).toBe('—');
    expect(
      result.current
        .getColumn('feedback')
        ?.columnDef.meta?.foldValue?.(lhr({ aftercareCall: 'none' })),
    ).toBeNull();
  });

  it('names a dental treatment’s teeth as its area, and its other values as details', () => {
    const { result } = renderHook(() => useTreatmentsTable(rows, {}), { wrapper });
    const dental = lhr({
      template: 'dental',
      params: { procedure: 'Filling', teeth: '1112', material: 'Composite' },
    });
    expect(result.current.getColumn('area')?.accessorFn?.(dental, 0)).toBe('#11, #12');
    expect(result.current.getColumn('details')?.accessorFn?.(dental, 0)).toBe(
      'Filling · Composite',
    );
    const bare = lhr({ template: 'general', params: {}, bodyParts: [] });
    expect(result.current.getColumn('area')?.accessorFn?.(bare, 0)).toBe('');
    expect(result.current.getColumn('details')?.accessorFn?.(bare, 0)).toBe('—');
    expect(
      result.current.getColumn('area')?.columnDef.meta?.foldValue?.(bare),
    ).toBeNull();
  });
});
