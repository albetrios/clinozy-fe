import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoice: vi.fn(),
  listInvoices: vi.fn(),
  fetchInvoiceTotals: vi.fn(),
  fetchInvoicePresets: vi.fn(),
  previewInvoice: vi.fn(),
  previewInvoiceChange: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  restoreInvoice: vi.fn(),
}));
vi.mock('@/shared/api/app/invoices-fixture-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createSale: vi.fn(),
  fetchPrescriptionPreset: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import { appointmentQueryKeys } from '@/shared/api/app/appointments-api.ts';
import {
  createInvoice,
  deleteInvoice,
  fetchInvoice,
  fetchInvoicePresets,
  fetchInvoiceTotals,
  invoiceQueryKeys,
  listInvoices,
  previewInvoice,
  previewInvoiceChange,
  restoreInvoice,
  updateInvoice,
} from '@/shared/api/app/invoices-api.ts';
import type {
  InvoiceDetail,
  InvoiceInput,
  InvoicePreview,
} from '@/shared/api/app/invoices-contracts.ts';
import {
  createSale,
  fetchPrescriptionPreset,
  fixtureInvoiceQueryKeys,
} from '@/shared/api/app/invoices-fixture-api.ts';
import { paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import { fixtureLedgerQueryKeys } from '@/shared/api/app/payments-fixture-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  invoiceRecord,
  TEST_INVOICE_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  INVOICE_WRITE_KEYS,
  useCreateInvoice,
  useCreateSale,
  useDeleteInvoice,
  useInvoice,
  useInvoiceList,
  useInvoicePresets,
  useInvoicePreview,
  useInvoiceTotals,
  usePrescriptionPreset,
  useRestoreInvoice,
  useUpdateInvoice,
} from './useInvoices.ts';

const INPUT: InvoiceInput = {
  type: 'consultation',
  branchId: TEST_MONEY_BRANCH_ID,
  contactId: TEST_MONEY_CONTACT_ID,
  teamIds: [],
  items: [
    {
      id: null,
      offeringId: 'off_3f4nzxf53tfyf9k6hlna1',
      qty: 1,
      discountPct: 0,
      suggestionId: null,
      treatmentIds: [],
    },
  ],
  overallDiscount: 0,
  date: '2026-10-10',
  remark: null,
  prescriptionId: null,
  paidNow: [],
};

const DETAIL: InvoiceDetail = {
  invoice: invoiceRecord(),
  party: null,
  sale: null,
  payments: [],
  sheet: {
    organization: { name: 'Glow', specialties: [], currency: 'INR' },
    branch: null,
  },
};

const PREVIEW: InvoicePreview = {
  type: 'consultation',
  date: '2026-10-10',
  items: [],
  overallDiscount: 0,
  subtotal: 500,
  discountTotal: 0,
  taxableTotal: 500,
  gstTotal: 0,
  total: 500,
  paid: 0,
  due: 500,
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('INVOICE_WRITE_KEYS', () => {
  it('refreshes every money read, the appointments and the tasks — never the fixture ledger', () => {
    expect(INVOICE_WRITE_KEYS).toEqual(
      expect.arrayContaining([
        paymentQueryKeys.all,
        invoiceQueryKeys.all,
        appointmentQueryKeys.all,
      ]),
    );
    expect(INVOICE_WRITE_KEYS).not.toContainEqual(fixtureLedgerQueryKeys.all);
  });
});

describe('the reads', () => {
  it('reads one invoice, a person’s pages, their totals and Quick fill, under the organization', async () => {
    vi.mocked(fetchInvoice).mockResolvedValue(DETAIL);
    vi.mocked(listInvoices).mockResolvedValue({
      rows: [invoiceRecord()],
      next: null,
      total: 1,
      totals: { due: 100, paid: 400 },
    });
    vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 100, paid: 400 });
    vi.mocked(fetchInvoicePresets).mockResolvedValue({
      packages: [],
      lastByType: {},
      recentTeamIds: [],
    });
    const { result } = renderHook(
      () => ({
        one: useInvoice(TEST_INVOICE_ID),
        list: useInvoiceList({ patientId: TEST_MONEY_PATIENT_ID }),
        totals: useInvoiceTotals({ patientId: TEST_MONEY_PATIENT_ID }),
        presets: useInvoicePresets(TEST_MONEY_PATIENT_ID),
        idle: useInvoiceTotals(null),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.one.data).toEqual(DETAIL));
    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.totals.data).toEqual({ due: 100, paid: 400 }),
    );
    await waitFor(() => expect(result.current.presets.data?.packages).toEqual([]));
    expect(listInvoices).toHaveBeenCalledWith(
      { patientId: TEST_MONEY_PATIENT_ID },
      undefined,
    );
    expect(result.current.idle.fetchStatus).toBe('idle');
  });

  it('previews a bill, or a change of an invoice; idle without one', async () => {
    vi.mocked(previewInvoice).mockResolvedValue(PREVIEW);
    vi.mocked(previewInvoiceChange).mockResolvedValue(PREVIEW);
    const invoice = invoiceRecord();
    const { result } = renderHook(
      () => ({
        bill: useInvoicePreview(INPUT),
        change: useInvoicePreview(INPUT, invoice),
        idle: useInvoicePreview(null),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.bill.data?.total).toBe(500));
    await waitFor(() => expect(result.current.change.data?.total).toBe(500));
    expect(previewInvoice).toHaveBeenCalledWith(INPUT);
    expect(previewInvoiceChange).toHaveBeenCalledWith({ invoice, input: INPUT });
    expect(result.current.idle.fetchStatus).toBe('idle');
  });
});

describe('the writes', () => {
  it('bills, changes, deletes and restores with the action’s key', async () => {
    vi.mocked(createInvoice).mockResolvedValue({ detail: DETAIL, planLinked: 0 });
    vi.mocked(updateInvoice).mockResolvedValue({ detail: DETAIL, planLinked: 0 });
    vi.mocked(deleteInvoice).mockResolvedValue();
    vi.mocked(restoreInvoice).mockResolvedValue(invoiceRecord());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        create: useCreateInvoice(),
        update: useUpdateInvoice(),
        remove: useDeleteInvoice(),
        restore: useRestoreInvoice(),
      }),
      { wrapper },
    );

    await act(() => result.current.create.mutateAsync(INPUT));
    expect(createInvoice).toHaveBeenCalledWith({
      input: INPUT,
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: appointmentQueryKeys.all }),
    );

    const invoice = invoiceRecord();
    await act(() => result.current.update.mutateAsync({ invoice, input: INPUT }));
    expect(updateInvoice).toHaveBeenCalledWith({
      invoice,
      input: INPUT,
      idempotencyKey: expect.any(String),
    });

    await act(() =>
      result.current.remove.mutateAsync({
        id: TEST_INVOICE_ID,
        reason: 'mistake',
        note: null,
      }),
    );
    expect(deleteInvoice).toHaveBeenCalledWith({
      invoiceId: TEST_INVOICE_ID,
      reason: 'mistake',
      note: null,
    });

    await act(() => result.current.restore.mutateAsync(TEST_INVOICE_ID));
    expect(restoreInvoice).toHaveBeenCalledWith(TEST_INVOICE_ID, expect.any(String));
  });

  it('never asks the drawer’s preview again after a save — its sessions are billed by then', async () => {
    vi.mocked(previewInvoice).mockResolvedValue(PREVIEW);
    vi.mocked(createInvoice).mockResolvedValue({ detail: DETAIL, planLinked: 0 });
    const { result } = renderHook(
      () => ({ preview: useInvoicePreview(INPUT), create: useCreateInvoice() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.preview.data?.total).toBe(500));
    expect(previewInvoice).toHaveBeenCalledTimes(1);

    await act(() => result.current.create.mutateAsync(INPUT));

    expect(previewInvoice).toHaveBeenCalledTimes(1);
    expect(
      invoiceQueryKeys.preview('org_x', null, {}).slice(0, invoiceQueryKeys.all.length),
    ).not.toEqual([...invoiceQueryKeys.all]);
  });
});

describe('a Medical sale (the fixture world)', () => {
  it('sells on the fixture server and reads its prescription there', async () => {
    vi.mocked(createSale).mockResolvedValue({} as never);
    vi.mocked(fetchPrescriptionPreset).mockResolvedValue({
      id: 'rx',
      seq: 500,
      patientId: 'p',
      medicines: [],
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ sell: useCreateSale(), preset: usePrescriptionPreset('rx') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.preset.data?.seq).toBe(500));
    await act(() => result.current.sell.mutateAsync({} as never));
    expect(createSale).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: fixtureLedgerQueryKeys.all }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: fixtureInvoiceQueryKeys.all }),
    );
  });
});
