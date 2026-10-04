import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  branchRef,
  MAIN_BRANCH,
} from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceInput } from '@/shared/api/clinic/invoices-contracts.ts';
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';

import {
  INVOICE_WRITE_KEYS,
  useAddMedicalContact,
  useCreateInvoice,
  useDeleteInvoice,
  useInvoice,
  useInvoicePresets,
  useOftenBilled,
  useRestoreInvoice,
  useSetMedicalContactPhone,
  useUpdateInvoice,
} from './useInvoices.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const DHARTI = patientRef('Dharti Galani');

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const backPeeling = () => {
  const offering = clinicFixtures.offerings.snapshot().find((row) => row.seq === 271);
  if (!offering) throw new Error('offering #271');
  return offering;
};

const input = (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
  type: 'clinic',
  branchId: branchRef(MAIN_BRANCH),
  patientId: DHARTI,
  medicalContactId: null,
  leadId: null,
  teamIds: [],
  items: [
    {
      offeringId: backPeeling().id,
      medicineId: null,
      name: 'Back Peeling',
      packSize: null,
      qty: 1,
      rate: 300_000,
      discountPct: 0,
      gstPct: 0,
    },
  ],
  overallDiscount: 0,
  date: '2026-10-03',
  remark: null,
  prescriptionId: null,
  paidNow: [],
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  vi.useRealTimers();
  client.clear();
  resetClinicFixtures();
});

describe('useInvoices — reads', () => {
  it('reads one invoice with its balance, and idles without an id', async () => {
    const { result } = renderHook(() => useInvoice(ref.invoice(785)), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.balance).toMatchObject({ bill: 130_000, due: 70_000 });

    const idle = renderHook(() => useInvoice(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });

  it('reads Quick fill’s presets for a patient, idle without one', async () => {
    const { result } = renderHook(() => useInvoicePresets(DHARTI), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.lastByType.clinic?.seq).toBe(787);
    expect(
      renderHook(() => useInvoicePresets(null), { wrapper }).result.current.fetchStatus,
    ).toBe('idle');
  });

  it('reads the names billed most', async () => {
    const { result } = renderHook(() => useOftenBilled('clinic'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toContain('Back Peeling');
  });
});

describe('useInvoices — writes', () => {
  it('refreshes every money read, the plans, tasks and stock after a write', () => {
    const roots = INVOICE_WRITE_KEYS.map((key) => JSON.stringify(key));
    expect(roots).toContain(JSON.stringify(paymentQueryKeys.all));
    expect(roots).toContain(JSON.stringify(invoiceQueryKeys.all));
    expect(roots).toContain(JSON.stringify(['clinic', 'tasks']));
    expect(roots).toContain(JSON.stringify(['clinic', 'medicines']));
  });

  it('creates an invoice and invalidates the ledger', async () => {
    const ledger = paymentQueryKeys.list({});
    client.setQueryData(ledger, { pages: [] });
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });
    let seq = 0;
    await act(async () => {
      seq = (await result.current.mutateAsync(input())).detail.invoice.seq;
    });
    expect(seq).toBeGreaterThan(791);
    expect(client.getQueryState(ledger)?.isInvalidated).toBe(true);
  });

  it('sends a Medical invoice through the sale', async () => {
    const azelan = clinicFixtures.medicines.snapshot().find((row) => row.seq === 450);
    if (!azelan) throw new Error('medicine #450');
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });
    let saleId: string | null = null;
    await act(async () => {
      const saved = await result.current.mutateAsync(
        input({
          type: 'medical',
          items: [
            {
              offeringId: null,
              medicineId: azelan.id,
              name: azelan.name,
              packSize: null,
              qty: 1,
              rate: azelan.mrp,
              discountPct: 0,
              gstPct: 0,
            },
          ],
        }),
      );
      saleId = saved.detail.sale?.id ?? null;
    });
    expect(saleId).not.toBeNull();
  });

  it('updates, deletes and restores an invoice', async () => {
    const create = renderHook(() => useCreateInvoice(), { wrapper });
    let id = '';
    await act(async () => {
      id = (await create.result.current.mutateAsync(input())).detail.invoice.id;
    });
    const update = renderHook(() => useUpdateInvoice(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({
        id,
        input: input({ remark: 'Paid at desk' }),
      });
    });
    expect((await clinicFixtures.invoices.get(id)).remark).toBe('Paid at desk');

    const remove = renderHook(() => useDeleteInvoice(), { wrapper });
    await act(async () => {
      await remove.result.current.mutateAsync({ id, reason: 'mistake', note: null });
    });
    expect(clinicFixtures.invoices.snapshot((row) => row.id === id)).toEqual([]);

    const restore = renderHook(() => useRestoreInvoice(), { wrapper });
    await act(async () => {
      await restore.result.current.mutateAsync(id);
    });
    expect(clinicFixtures.invoices.snapshot((row) => row.id === id)).toHaveLength(1);
  });

  it('adds a Medical contact and saves its mobile', async () => {
    const add = renderHook(() => useAddMedicalContact(), { wrapper });
    let contactId = '';
    await act(async () => {
      contactId = (await add.result.current.mutateAsync('Neha Rao')).id;
    });
    const phone = renderHook(() => useSetMedicalContactPhone(), { wrapper });
    await act(async () => {
      await phone.result.current.mutateAsync({ id: contactId, phone: '+919876543210' });
    });
    expect((await clinicFixtures.medicalContacts.get(contactId)).phone).toBe(
      '+919876543210',
    );
  });
});
