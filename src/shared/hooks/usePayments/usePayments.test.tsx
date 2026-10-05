import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as PaymentsApiModule from '@/shared/api/clinic/payments-api.ts';
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';

import {
  MONEY_WRITE_KEYS,
  useDeletePayment,
  useLedgerList,
  useOpenInvoices,
  useOpenSupplierBills,
  usePatientInvoices,
  usePatientPayments,
  usePayment,
  useRestorePayment,
} from './usePayments.ts';

/** Holds a delete until a test lets it land, so the optimistic patch can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));
vi.mock('@/shared/api/clinic/payments-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof PaymentsApiModule>();
  return {
    ...actual,
    deletePayment: async (...args: Parameters<typeof actual.deletePayment>) => {
      await gate.hold;
      return actual.deletePayment(...args);
    },
  };
});
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  gate.hold = null;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  vi.useRealTimers();
  client.clear();
  resetClinicFixtures();
});

describe('MONEY_WRITE_KEYS', () => {
  it('refreshes the ledger, the credits, the patients’ dues and the invoices', () => {
    expect(MONEY_WRITE_KEYS).toContainEqual(paymentQueryKeys.all);
    expect(MONEY_WRITE_KEYS).toContainEqual(['clinic', 'credits']);
    expect(MONEY_WRITE_KEYS).toContainEqual(['clinic', 'patients']);
    expect(MONEY_WRITE_KEYS).toContainEqual(['clinic', 'invoices']);
  });
});

describe('the ledger reads', () => {
  it('pages the ledger under the domain key', async () => {
    const { result } = renderHook(() => useLedgerList({ direction: 'paid' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(7));
    expect(result.current.hasNextPage).toBe(false);
    expect(
      client.getQueryCache().findAll({ queryKey: paymentQueryKeys.lists() })[0],
    ).toBeTruthy();
  });

  it('reads one entry, and stays idle without an id', async () => {
    const { result } = renderHook(() => usePayment(ref.payment(310)), { wrapper });
    await waitFor(() => expect(result.current.data?.partyName).toBe('Tea & snacks'));
    const idle = renderHook(() => usePayment(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });

  it('reads a patient’s open invoices and the open supplier bills', async () => {
    const invoices = renderHook(() => useOpenInvoices(patientRef('Rhea Shah')), {
      wrapper,
    });
    await waitFor(() => expect(invoices.result.current.data?.[0]?.seq).toBe(785));
    const none = renderHook(() => useOpenInvoices(null), { wrapper });
    expect(none.result.current.fetchStatus).toBe('idle');
    const bills = renderHook(() => useOpenSupplierBills(), { wrapper });
    await waitFor(() => expect(bills.result.current.data).toHaveLength(3));
  });
});

describe('the ledger writes', () => {
  it('drops a deleted entry from every cached page at once, and Undo puts it back', async () => {
    const list = renderHook(() => useLedgerList({}), { wrapper });
    await waitFor(() => expect(list.result.current.rows).toHaveLength(16));
    let release: () => void = () => undefined;
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });
    const remove = renderHook(() => useDeletePayment(), { wrapper });
    act(() => {
      remove.result.current.mutate({
        id: ref.payment(310),
        reason: 'duplicate',
        note: null,
      });
    });
    await waitFor(() => expect(list.result.current.rows).toHaveLength(15));
    const has310 = (rows: readonly LedgerRow[]) => rows.some((row) => row.seq === 310);
    expect(has310(list.result.current.rows)).toBe(false);
    release();
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true));

    const restore = renderHook(() => useRestorePayment(), { wrapper });
    await act(() => restore.result.current.mutateAsync(ref.payment(310)));
    await waitFor(() => expect(has310(list.result.current.rows)).toBe(true));
  });
});

describe('the patient file’s money reads', () => {
  const dharti = patientRef('Dharti Galani');

  it('reads her receipts and refunds, newest first; idle without her', async () => {
    const { result } = renderHook(() => usePatientPayments(dharti), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((row) => row.seq)).toEqual([5505]);
    expect(result.current.data?.[0]).toMatchObject({
      direction: 'received',
      invoice: { seq: 782 },
    });
    const idle = renderHook(() => usePatientPayments(''), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });

  it('reads every invoice of hers with its items, team, status and sale', async () => {
    const { result } = renderHook(() => usePatientInvoices(dharti), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const lhr = result.current.data?.find((row) => row.seq === 787);
    expect(lhr).toMatchObject({
      items: ['LHR Full Face · B4G7'],
      status: 'unpaid',
      saleId: null,
    });
    const sale = result.current.data?.find((row) => row.seq === 788);
    expect(sale?.saleId).not.toBeNull();
  });
});
