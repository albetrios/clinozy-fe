import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PatientRow } from '@/shared/api/app/patients-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { patientRow } from '@/tests/utils/patient-doubles.ts';

import { type PatientsTableInput, usePatientsTable } from './usePatientsTable.tsx';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** Dharti — Regular, Aesthetic, a follow-up at 2:50 pm today — and Raam, with nothing set. */
const rows: PatientRow[] = [
  patientRow({
    id: 'pat_dharti000000000000000',
    seq: 3508,
    firstName: 'Dharti',
    lastName: 'Galani',
    name: 'Dharti Galani',
    status: 'regular',
    conversion: 'converted',
    followUpAt: '2026-10-03T09:20:00.000Z',
  }),
  patientRow({
    id: 'pat_raam00000000000000000',
    seq: 3441,
    firstName: 'Raam',
    lastName: 'Shah',
    name: 'Raam Shah',
    gender: null,
    dateOfBirth: null,
    types: [],
  }),
];

function renderTable(input: Partial<PatientsTableInput> = {}) {
  return renderHook(
    (props: Partial<PatientsTableInput>) =>
      usePatientsTable({
        rows,
        sort: undefined,
        onSortChange: vi.fn(),
        contactActions: () => ({}),
        ...props,
      }),
    { initialProps: input },
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useDevicePrefsStore.setState({ hiddenColumns: {} });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('usePatientsTable', () => {
  it('lays out the nine columns, keyed by the URL’s sort keys, the ID locked — no Due', () => {
    const { result } = renderTable();
    const columns = result.current.getAllLeafColumns();
    expect(columns.map((column) => column.id)).toEqual([
      'seq',
      'name',
      'gender',
      'types',
      'status',
      'conversion',
      'age',
      'followUp',
      'updated',
    ]);
    expect(columns.find((column) => column.id === 'seq')?.getCanHide()).toBe(false);
    // Only ID and Follow-up sort — the two the API sorts by.
    expect(
      columns.filter((column) => column.getCanSort()).map((column) => column.id),
    ).toEqual(['seq', 'followUp']);
  });

  it('starts on the recommended set: Gender, Conversion and Age hidden', () => {
    const { result } = renderTable();
    expect(result.current.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      'seq',
      'name',
      'types',
      'status',
      'followUp',
      'updated',
    ]);
  });

  it('reads its sort from the URL and writes a header click back to it', () => {
    const onSortChange = vi.fn();
    const { result } = renderTable({ sort: 'followUp:desc', onSortChange });
    expect(result.current.getColumn('followUp')?.getIsSorted()).toBe('desc');
    act(() => result.current.getColumn('seq')?.toggleSorting(false));
    expect(onSortChange).toHaveBeenCalledWith('seq:asc');
    // The URL still says Follow-up, descending: clearing it leaves no sort at all.
    act(() => result.current.getColumn('followUp')?.clearSorting());
    expect(onSortChange).toHaveBeenLastCalledWith(undefined);
  });

  it('folds each column to its meta-line value; Updated folds to nothing', async () => {
    const { result } = renderTable();
    await waitFor(() => expect(result.current.getRowModel().rows).toHaveLength(2));
    const [dharti, raam] = result.current.getRowModel().rows;
    expect(dharti?.id).toBe('pat_dharti000000000000000');
    const fold = (id: string, row = dharti) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(row?.original);
    expect(fold('seq')).toBe('#3508');
    expect(fold('gender')).toMatchObject({ value: 'Female' });
    expect(fold('types')).toMatchObject({
      value: 'Aesthetic',
      dotClassName: expect.stringContaining('bg-tone-lav-foreground'),
    });
    expect(fold('status')).toMatchObject({ value: 'Regular' });
    expect(fold('conversion')).toMatchObject({ value: 'T-Converted' });
    expect(fold('age')).toBe('30 yrs');
    expect(fold('followUp')).toMatchObject({
      dotClassName: expect.stringContaining('bg-tone-butter-foreground'),
    });
    expect(fold('updated')).toBeNull();
    // Nothing set folds to nothing.
    expect(fold('gender', raam)).toBeNull();
    expect(fold('types', raam)).toBeNull();
    expect(fold('age', raam)).toBeNull();
    expect(fold('followUp', raam)).toBeNull();
  });
});
