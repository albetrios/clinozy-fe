import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPayment } from '@/shared/api/clinic/payments-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { useLedgerRowActions } from './useLedgerRowActions.ts';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderActions(role: Role) {
  useUIStore.setState({ previewRole: role });
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const hook = renderHook(() => useLedgerRowActions({ onEdit, onDelete }), { wrapper });
  return { ...hook, onEdit, onDelete };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  useOrganizationStore.getState().setPermissions(['organization:read']);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  vi.useRealTimers();
  client.clear();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
  resetClinicFixtures();
});

describe('useLedgerRowActions (payments.md:34)', () => {
  it('offers Edit and Delete on an open day’s entry; Delete names what the invoice goes back to', async () => {
    const entry = await fetchPayment(ref.payment(5512));
    const { result, onEdit, onDelete } = renderActions('admin');
    await waitFor(() => expect(result.current(entry)).toHaveLength(2));
    const [edit, remove] = result.current(entry);
    expect(edit).toMatchObject({ id: 'edit', label: 'Edit' });
    expect(remove).toMatchObject({ id: 'delete', label: 'Delete', destructive: true });
    edit?.onSelect();
    expect(onEdit).toHaveBeenCalledWith(entry);
    remove?.onSelect();
    expect(onDelete).toHaveBeenCalledWith({
      entry,
      dueAfter: (entry.invoice?.due ?? 0) + entry.amount,
    });
  });

  it('keeps Delete to the room’s Delete, and offers nothing on a closed day', async () => {
    const open = await fetchPayment(ref.payment(310));
    const locked = await fetchPayment(ref.payment(305));
    const { result } = renderActions('front_desk');
    await waitFor(() => expect(result.current(open)).toHaveLength(1));
    expect(result.current(open)[0]).toMatchObject({ id: 'edit' });
    expect(result.current(locked)).toEqual([]);
  });
});
