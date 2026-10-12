import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { stockVendorRow, TEST_STOCK_VENDOR_ID } from '@/tests/utils/stock-doubles.ts';

const { notifyMock, recordsApi, readsApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  recordsApi: { createStockVendor: vi.fn(), updateStockVendor: vi.fn() },
  readsApi: { fetchStockVendor: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...recordsApi,
}));
vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...readsApi,
}));

import { stockQueryKeys } from '../../stock-api.ts';
import type { StockVendorRow } from '../../stock-contracts.ts';
import {
  useRefreshStockVendors,
  useVendorSave,
  vendorFormOf,
  type VendorFormValues,
} from './use-vendor-save.ts';

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/stock-vendors', 'POST', { error });

describe('vendorFormOf — the clinic vendor drawer’s form', () => {
  it('opens a saved vendor on its name and its mobile’s ten digits', () => {
    expect(vendorFormOf({ name: 'Ankur Pharma', phone: '+919876500011' })).toEqual({
      name: 'Ankur Pharma',
      phone: '9876500011',
    });
    expect(vendorFormOf({ name: 'Ankur Pharma', phone: null })).toEqual({
      name: 'Ankur Pharma',
      phone: '',
    });
  });

  it('names a new vendor from the picker’s text — trimmed and held to the name’s limit', () => {
    expect(vendorFormOf(null)).toEqual({ name: '', phone: '' });
    expect(vendorFormOf(null, '  Ankit Traders ')).toEqual({
      name: 'Ankit Traders',
      phone: '',
    });
    expect(vendorFormOf(null, 'x'.repeat(200)).name).toHaveLength(120);
  });
});

describe('useVendorSave — New / Edit clinic vendor’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    vendor = null,
    values,
    stacked = false,
  }: {
    vendor?: StockVendorRow | null;
    values: VendorFormValues;
    stacked?: boolean;
  }) {
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<VendorFormValues>({ defaultValues: values });
        return { form, drawer: useVendorSave({ form, vendor, stacked, onDone }) };
      },
      { wrapper },
    );
    return { ...view, onDone };
  }

  const saved = (patch: Partial<StockVendorRow> = {}) => ({
    ...stockVendorRow(),
    ...patch,
  });

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [
      ...Object.values(notifyMock),
      ...Object.values(recordsApi),
      ...Object.values(readsApi),
    ]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  it('asks for a name, then a ten-digit mobile, before anything is sent', async () => {
    const noName = render({ values: { name: '   ', phone: '' } });
    await act(() => noName.result.current.drawer.save());
    expect(noName.result.current.form.getFieldState('name').error?.message).toBe(
      'Add a name',
    );
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a name');

    const shortPhone = render({ values: { name: 'Ankit Traders', phone: '98765' } });
    await act(() => shortPhone.result.current.drawer.save());
    expect(shortPhone.result.current.form.getFieldState('phone').error?.message).toBe(
      'Enter a 10-digit mobile',
    );
    expect(recordsApi.createStockVendor).not.toHaveBeenCalled();
  });

  it('adds a vendor — the name trimmed, the mobile in E.164 — and says so', async () => {
    recordsApi.createStockVendor.mockResolvedValue(saved({ name: 'Ankit Traders' }));
    const { result, onDone } = render({
      values: { name: ' Ankit Traders ', phone: '9876500022' },
    });

    await act(() => result.current.drawer.save());

    expect(recordsApi.createStockVendor).toHaveBeenCalledWith({
      input: { name: 'Ankit Traders', phone: '+919876500022', isQuick: false },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor Ankit Traders added');
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ankit Traders' }),
      false,
    );
  });

  it('adds a quick vendor from a picker’s stacked drawer, with no mobile', async () => {
    recordsApi.createStockVendor.mockResolvedValue(saved({ isQuick: true, phone: null }));
    const { result } = render({
      values: { name: 'Cash vendor', phone: '' },
      stacked: true,
    });

    await act(() => result.current.drawer.save());

    expect(recordsApi.createStockVendor).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { name: 'Cash vendor', phone: null, isQuick: true },
      }),
    );
  });

  it('saves an edit against the vendor as read — never as a quick one', async () => {
    const vendor = stockVendorRow();
    recordsApi.updateStockVendor.mockResolvedValue(saved({ name: 'Ankur Pharma Pvt' }));
    const { result, onDone } = render({
      vendor,
      values: { name: 'Ankur Pharma Pvt', phone: '9876500011' },
      stacked: true,
    });

    await act(() => result.current.drawer.save());

    expect(recordsApi.updateStockVendor).toHaveBeenCalledWith({
      record: vendor,
      input: { name: 'Ankur Pharma Pvt', phone: '+919876500011' },
      idempotencyKey: expect.any(String),
    });
    expect(recordsApi.createStockVendor).not.toHaveBeenCalled();
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor saved');
    expect(onDone).toHaveBeenCalledOnce();
    expect(result.current.drawer.record).toBe(vendor);
  });

  it('puts a name another vendor has on Name, in the room’s words', async () => {
    recordsApi.createStockVendor.mockRejectedValue(
      refusal(409, { reason: 'record_already_exists', detail: 'stock_vendor exists' }),
    );
    const { result, onDone } = render({ values: { name: 'Ankur Pharma', phone: '' } });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('name').error?.message).toBe(
      'A vendor with this name already exists',
    );
    expect(notifyMock.error).toHaveBeenCalledWith(
      'A vendor with this name already exists',
      {
        id: 'stock-vendor-save-failed',
      },
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('says another conflict in the server’s words, on no field', async () => {
    recordsApi.createStockVendor.mockRejectedValue(
      refusal(409, { reason: 'vendor_locked', detail: 'This vendor is locked' }),
    );
    const { result } = render({ values: { name: 'Ankur Pharma', phone: '' } });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('name').error).toBeUndefined();
    expect(notifyMock.error).toHaveBeenCalledWith('This vendor is locked', {
      id: 'stock-vendor-save-failed',
    });
  });

  it('puts the server’s phone refusal on Phone', async () => {
    recordsApi.createStockVendor.mockRejectedValue(
      refusal(400, {
        type: 'validation_error',
        errors: [{ field: 'body.phone', message: 'Use +91 and ten digits' }],
      }),
    );
    const { result } = render({ values: { name: 'Ankit Traders', phone: '9876500022' } });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('phone').error?.message).toBe(
      'Use +91 and ten digits',
    );
    expect(notifyMock.error).toHaveBeenCalledWith('Use +91 and ten digits');
  });

  it('reads a stale vendor again on Reload and starts the form over on it', async () => {
    const vendor = stockVendorRow();
    const fresh = stockVendorRow({
      name: 'Ankur Pharma (Adajan)',
      phone: '+919876500099',
      updatedAt: '2026-10-12T05:00:00.000Z',
    });
    recordsApi.updateStockVendor.mockRejectedValue(
      refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
    );
    readsApi.fetchStockVendor.mockResolvedValue(fresh);
    const { result } = render({ vendor, values: { name: 'Mine', phone: '9876500011' } });

    await act(() => result.current.drawer.save());

    const [, options] = notifyMock.error.mock.lastCall as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(options.action.label).toBe('Reload');
    await act(async () => options.action.onClick());

    await waitFor(() =>
      expect(result.current.form.getValues()).toEqual({
        name: 'Ankur Pharma (Adajan)',
        phone: '9876500099',
      }),
    );
    expect(readsApi.fetchStockVendor).toHaveBeenCalledWith(TEST_STOCK_VENDOR_ID);
    expect(result.current.drawer.record).toEqual(fresh);
  });

  it('offers no Reload on a new vendor', async () => {
    recordsApi.createStockVendor.mockRejectedValue(
      refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
    );
    const { result } = render({ values: { name: 'Ankit Traders', phone: '' } });

    await act(() => result.current.drawer.save());

    const [, options] = notifyMock.error.mock.lastCall as [string, { action?: unknown }];
    expect(options.action).toBeUndefined();
  });
});

describe('useRefreshStockVendors', () => {
  it('reads the Vendors list and its footer again — and the vendor itself when named', () => {
    signInTestMember();
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    const { result } = renderHook(() => useRefreshStockVendors(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    result.current();
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      stockQueryKeys.vendorLists('org_test'),
      [...stockQueryKeys.summaries('org_test'), 'vendors'],
    ]);

    invalidate.mockClear();
    result.current(TEST_STOCK_VENDOR_ID);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(
      stockQueryKeys.vendor('org_test', TEST_STOCK_VENDOR_ID),
    );
    expect(invalidate).toHaveBeenCalledTimes(3);
  });
});
