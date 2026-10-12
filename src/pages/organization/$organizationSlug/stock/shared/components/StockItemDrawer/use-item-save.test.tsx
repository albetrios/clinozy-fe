import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';
import { formFieldOf } from '@/shared/errors/map-validation-errors.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { stockItemRow, TEST_STOCK_ITEM_ID } from '@/tests/utils/stock-doubles.ts';

const { notifyMock, readsApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  readsApi: { fetchStockItem: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...readsApi,
}));

import { stockQueryKeys } from '../../stock-api.ts';
import type { StockItemFormValues } from './stock-item-form.ts';
import { ITEM_SERVER_FIELDS, readStockItem, useItemConflict } from './use-item-save.ts';

const conflict = (reason: string | undefined, detail: string) =>
  new HttpError('HTTP 409', 409, '/api/v1/app/stock-items', 'POST', {
    error: { type: 'conflict', ...(reason ? { reason } : {}), detail },
  });

describe('useItemConflict — a refused item save (409)', () => {
  beforeEach(() => {
    for (const fn of Object.values(notifyMock)) fn.mockReset();
  });

  function render() {
    const openNameStep = vi.fn();
    const view = renderHook(() => {
      const form = useForm<StockItemFormValues>();
      return { form, onConflict: useItemConflict(form, openNameStep) };
    });
    return { ...view, openNameStep };
  }

  it('puts a name another item has on Name, opens its step and says it in the room’s words', () => {
    const { result, openNameStep } = render();
    act(() =>
      result.current.onConflict(
        conflict('record_already_exists', 'stock_item with name "cotton" already exists'),
      ),
    );
    expect(result.current.form.getFieldState('name').error).toMatchObject({
      type: 'server',
      message: 'An item with this name already exists',
    });
    expect(openNameStep).toHaveBeenCalledOnce();
    expect(notifyMock.error).toHaveBeenCalledWith(
      'An item with this name already exists',
    );
  });

  it('leaves Name alone for any other refusal — the server’s words, no step opened', () => {
    const { result, openNameStep } = render();
    act(() =>
      result.current.onConflict(conflict('item_in_use', 'This item has open purchases')),
    );
    act(() => result.current.onConflict(conflict(undefined, 'Something conflicts')));
    expect(result.current.form.getFieldState('name').error).toBeUndefined();
    expect(openNameStep).not.toHaveBeenCalled();
    expect(notifyMock.error.mock.calls.map(([message]) => message)).toEqual([
      'This item has open purchases',
      'Something conflicts',
    ]);
  });
});

describe('ITEM_SERVER_FIELDS — the API’s item fields on the form', () => {
  it('maps each field as the shared mapper names it to the form’s own', () => {
    const onForm = (wire: string) => ITEM_SERVER_FIELDS[formFieldOf(wire)];
    expect(onForm('body.size_per_unit')).toBe('contents');
    expect(onForm('body.measure_unit')).toBe('measure');
    expect(onForm('body.min_quantity')).toBe('minQty');
    expect(onForm('body.max_quantity')).toBe('maxQty');
    expect(onForm('body.usage_per_week')).toBe('usage');
    expect(onForm('body.stock_vendor_id')).toBe('vendorId');
    // An opening quantity on a create and an edit's Adjust both land on In stock.
    expect(onForm('body.opening_quantity')).toBe('inStock');
    expect(onForm('body.quantity')).toBe('inStock');
    expect(onForm('body.name')).toBeUndefined();
  });
});

describe('readStockItem — the edit drawer’s reload past the cache', () => {
  it('reads the item by its id under its own key', async () => {
    signInTestMember();
    const item = stockItemRow();
    const fresh = stockItemRow({ name: 'Soframycin 30 g' });
    readsApi.fetchStockItem.mockResolvedValue(fresh);

    const read = readStockItem(item, 'org_test');

    expect(read.queryKey).toEqual(stockQueryKeys.item('org_test', TEST_STOCK_ITEM_ID));
    await expect(read.queryFn()).resolves.toBe(fresh);
    expect(readsApi.fetchStockItem).toHaveBeenCalledWith(TEST_STOCK_ITEM_ID);
  });

  it('goes through a query client like any read', async () => {
    const client = new QueryClient();
    readsApi.fetchStockItem.mockResolvedValue(stockItemRow());
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(() => null, { wrapper });
    const read = readStockItem(stockItemRow(), null);
    await expect(client.fetchQuery(read)).resolves.toMatchObject({
      id: TEST_STOCK_ITEM_ID,
    });
  });
});
