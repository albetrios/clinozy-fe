import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import {
  prescriptionLine,
  prescriptionRecord,
} from '../../__tests__/integration/prescription-doubles.ts';
import { usePrescriptionsTable } from './usePrescriptionsTable.tsx';

vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { DOCTOR_NISHA } = await import('@/tests/utils/appointment-doubles.ts');
  return {
    ...(await importOriginal<object>()),
    fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA]),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => 'mem_nisha0000000000000000'),
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const RX = prescriptionRecord({
  items: [
    prescriptionLine(),
    prescriptionLine({ medicineName: 'Clonix-B Lotion', doseNight: 0, meal: null }),
  ],
  procedureToday: 'Peel',
});
const APPROVED = prescriptionRecord({
  id: 'rx_rx49900000000000000000',
  status: 'approved',
});

beforeEach(() => {
  signInTestMember();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

describe('usePrescriptionsTable (H:4753)', () => {
  it('lays out ID · Date · Medicines · Notes · Doctor · Status · Updated, Notes and Updated hidden', () => {
    const { result } = renderHook(() => usePrescriptionsTable([RX]), { wrapper });
    const table = result.current;
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual([
      'id',
      'date',
      'medicines',
      'notes',
      'doctor',
      'status',
      'updated',
    ]);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      'id',
      'date',
      'medicines',
      'doctor',
      'status',
    ]);
    expect(table.getColumn('date')?.columnDef.meta?.primary).toBe(true);
    expect(table.getColumn('medicines')?.columnDef.meta?.track).toBe('minmax(240px,2fr)');
  });

  it('reads the medicines, the notes and the number', () => {
    const { result } = renderHook(() => usePrescriptionsTable([RX]), { wrapper });
    const value = (id: string) => result.current.getColumn(id)?.accessorFn?.(RX, 0);
    expect(value('medicines')).toBe('Flubolt 400, Clonix-B Lotion');
    expect(value('notes')).toBe('Avoid sun · Peel');
    expect(result.current.getColumn('id')?.columnDef.meta?.foldValue?.(RX)).toBe('#500');
  });

  it('tells a draft from an approved one in Status', () => {
    const { result } = renderHook(() => usePrescriptionsTable([RX, APPROVED]), {
      wrapper,
    });
    const status = result.current.getColumn('status')?.accessorFn;
    expect(status?.(RX, 0)).toEqual(expect.any(String));
    expect(status?.(APPROVED, 0)).not.toBe(status?.(RX, 0));
  });

  it('names the doctor from the team; the people fold to nothing', async () => {
    const { result } = renderHook(() => usePrescriptionsTable([RX]), { wrapper });
    const meta = (id: string) => result.current.getColumn(id)?.columnDef.meta;
    expect(meta('doctor')?.foldValue?.(RX)).toBeNull();
    expect(meta('updated')?.foldValue?.(RX)).toBeNull();
    await waitFor(() =>
      expect(result.current.getColumn('doctor')?.accessorFn?.(RX, 0)).toBe('Nisha Shah'),
    );
  });
});
