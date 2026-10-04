import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listPatients } from '@/shared/api/clinic/patients-api.ts';
import type { PatientRow } from '@/shared/api/clinic/patients-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { type PatientsTableInput, usePatientsTable } from './usePatientsTable.tsx';

/** 10:00 on 3 Oct, clinic time — the seed day is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

let rows: PatientRow[] = [];

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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  rows = (await listPatients()).items;
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('usePatientsTable', () => {
  it('lays out the ten columns, keyed by the URL’s sort keys, the ID locked', () => {
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
      'due',
      'updated',
    ]);
    expect(columns.find((column) => column.id === 'seq')?.getCanHide()).toBe(false);
    expect(columns.find((column) => column.id === 'gender')?.getCanSort()).toBe(false);
    expect(columns.find((column) => column.id === 'due')?.columnDef.meta).toMatchObject({
      track: '96px',
      align: 'end',
    });
  });

  it('starts on the recommended set: Gender, Conversion and Age hidden', () => {
    const { result } = renderTable();
    expect(result.current.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      'seq',
      'name',
      'types',
      'status',
      'followUp',
      'due',
      'updated',
    ]);
  });

  it('reads its sort from the URL and writes a header click back to it', () => {
    const onSortChange = vi.fn();
    const { result } = renderTable({ sort: 'due:desc', onSortChange });
    expect(result.current.getColumn('due')?.getIsSorted()).toBe('desc');
    act(() => result.current.getColumn('name')?.toggleSorting(false));
    expect(onSortChange).toHaveBeenCalledWith('name:asc');
    // The URL still says Due, descending: clearing it leaves no sort at all.
    act(() => result.current.getColumn('due')?.clearSorting());
    expect(onSortChange).toHaveBeenLastCalledWith(undefined);
  });

  it('folds each column to its meta-line value; Updated folds to nothing', async () => {
    const { result } = renderTable();
    await waitFor(() => expect(result.current.getRowModel().rows).toHaveLength(30));
    const dharti = result.current
      .getRowModel()
      .rows.find((row) => row.original.seq === 3508);
    const fold = (id: string) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(dharti?.original);
    expect(fold('seq')).toBe('#3508');
    expect(fold('types')).toMatchObject({
      value: 'Aesthetic',
      dotClassName: expect.stringContaining('bg-tone-lav-foreground'),
    });
    expect(fold('status')).toMatchObject({ value: 'Regular' });
    expect(fold('followUp')).toMatchObject({
      dotClassName: expect.stringContaining('bg-tone-butter-foreground'),
    });
    expect(fold('due')).toMatch(/₹/);
    expect(fold('updated')).toBeNull();
  });
});
