import type { ColumnDef } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';

import { recommendedHiddenColumns, useHiddenColumns } from './useHiddenColumns.ts';

interface Patient {
  name: string;
  gender: string;
  contact: { email: string };
}

const COLUMNS: ColumnDef<DataTableFeatures, Patient>[] = [
  { accessorKey: 'name', header: 'Patient' },
  { accessorKey: 'gender', header: 'Gender', meta: { defaultHidden: true } },
  {
    header: 'Contact',
    columns: [
      { accessorKey: 'contact.email', header: 'Email', meta: { defaultHidden: true } },
    ],
  },
  { id: 'actions', header: '' },
];

beforeEach(() => {
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: {},
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
  });
});

describe('recommendedHiddenColumns', () => {
  it('collects the default-hidden ids with TanStack’s id rule, through groups', () => {
    expect(recommendedHiddenColumns(COLUMNS)).toEqual(['gender', 'contact_email']);
  });
});

describe('useHiddenColumns', () => {
  it('starts on the recommended set until the user changes anything', () => {
    const { result } = renderHook(() => useHiddenColumns('patients', COLUMNS));
    expect(result.current.columnVisibility).toEqual({
      gender: false,
      contact_email: false,
    });
  });

  it('persists the hidden columns per table on this device', () => {
    const { result } = renderHook(() => useHiddenColumns('patients', COLUMNS));
    act(() => {
      result.current.onColumnVisibilityChange((previous) => ({
        ...previous,
        gender: true,
        name: false,
      }));
    });
    expect(useDevicePrefsStore.getState().hiddenColumns.patients).toEqual([
      'contact_email',
      'name',
    ]);
    expect(result.current.columnVisibility).toEqual({
      contact_email: false,
      name: false,
    });
    // Another table keeps its own set.
    const other = renderHook(() => useHiddenColumns('payments', COLUMNS));
    expect(other.result.current.columnVisibility).toEqual({
      gender: false,
      contact_email: false,
    });
  });

  it('keeps an explicit "show everything" instead of falling back to the recommended set', () => {
    const { result } = renderHook(() => useHiddenColumns('patients', COLUMNS));
    act(() => result.current.onColumnVisibilityChange({}));
    expect(useDevicePrefsStore.getState().hiddenColumns.patients).toEqual([]);
    expect(result.current.columnVisibility).toEqual({});
  });

  it('keeps the same visibility object across renders with inline columns', () => {
    const { result, rerender } = renderHook(() =>
      useHiddenColumns('patients', [...COLUMNS]),
    );
    const first = result.current.columnVisibility;
    rerender();
    expect(result.current.columnVisibility).toBe(first);
  });
});
