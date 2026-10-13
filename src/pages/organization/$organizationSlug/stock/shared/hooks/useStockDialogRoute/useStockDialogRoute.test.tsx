import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';
import { stockItemRow, TEST_STOCK_ITEM_ID } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { fetchStockItem, stockQueryKeys } from '../../stock-api.ts';
import { useStockDialogRoute } from './useStockDialogRoute.ts';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchStockItem: vi.fn(),
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const ITEMS = '/organization/acme/stock/items';
const UNKNOWN = 'sitm_gone0000000000000000';

/** The dialog the Items URL names, written out. */
function Probe() {
  const { dialog } = useStockDialogRoute({
    tab: 'items',
    param: 'itemId',
    queryKey: stockQueryKeys.item,
    fetchRecord: fetchStockItem,
    recordLabel: 'Item',
    tabActions: ['check'],
  });
  let text: string = dialog.kind;
  if (dialog.kind === 'create') text += ` ${dialog.prefill.name ?? ''}`;
  if (dialog.kind === 'action') text += ` ${dialog.action}`;
  if (dialog.kind === 'record') text += ` ${dialog.action} ${dialog.record?.name ?? '…'}`;
  return <p data-testid="dialog">{text}</p>;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchStockItem).mockImplementation(async (id) => {
    if (id === TEST_STOCK_ITEM_ID) return stockItemRow();
    throw new HttpError('Not found', 404, `/app/stock-items/${id}`, 'GET');
  });
});
afterEach(() => resetStockRoutes());

describe('useStockDialogRoute (KICKOFF §6.8 Routes)', () => {
  it('reads the list, New item with its name, Stock check and Edit item', async () => {
    const list = renderStockRoutes(ITEMS, { items: Probe });
    expect(await screen.findByTestId('dialog')).toHaveTextContent('none');
    list.unmount();

    const create = renderStockRoutes(`${ITEMS}/create?name=Cotton`, { items: Probe });
    expect(await screen.findByTestId('dialog')).toHaveTextContent('create Cotton');
    create.unmount();

    const check = renderStockRoutes(`${ITEMS}/check`, { items: Probe });
    expect(await screen.findByTestId('dialog')).toHaveTextContent('action check');
    check.unmount();

    const { queryClient } = renderStockRoutes(`${ITEMS}/${TEST_STOCK_ITEM_ID}/edit`, {
      items: Probe,
    });
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent(
        'record edit Soframycin 30 gm',
      ),
    );
    // The record's read is the organization's.
    expect(
      queryClient.getQueryData(stockQueryKeys.item('org_test', TEST_STOCK_ITEM_ID)),
    ).toMatchObject({ seq: 167 });
  });

  it('goes back to the list, its search kept, with "Item not found" for an unknown id', async () => {
    const { router } = renderStockRoutes(`${ITEMS}/${UNKNOWN}/edit?q=soft`, {
      items: Probe,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(ITEMS));
    expect(router.state.location.search).toMatchObject({ q: 'soft' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Item not found · it may have been deleted',
    );
  });

  it('New item takes Create, Stock check takes Edit — the Accountant goes back from both', async () => {
    const create = renderStockRoutes(
      `${ITEMS}/create`,
      { items: Probe },
      { role: 'accountant' },
    );
    await waitFor(() => expect(create.router.state.location.pathname).toBe(ITEMS));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    create.unmount();

    const check = renderStockRoutes(
      `${ITEMS}/check`,
      { items: Probe },
      { role: 'accountant' },
    );
    await waitFor(() => expect(check.router.state.location.pathname).toBe(ITEMS));
    expect(screen.getByTestId('dialog')).toHaveTextContent('none');
    check.unmount();

    // A record still opens — view only.
    renderStockRoutes(
      `${ITEMS}/${TEST_STOCK_ITEM_ID}/edit`,
      { items: Probe },
      { role: 'accountant' },
    );
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent(
        'record edit Soframycin 30 gm',
      ),
    );
  });

  it('a member who creates without Edit opens New item but not Stock check', async () => {
    const create = renderStockRoutes(
      `${ITEMS}/create`,
      { items: Probe },
      { permissions: ['organization:read', 'stock_item:read', 'stock_item:create'] },
    );
    expect(await screen.findByTestId('dialog')).toHaveTextContent('create');
    expect(notifyMock.info).not.toHaveBeenCalled();
    create.unmount();

    const check = renderStockRoutes(
      `${ITEMS}/check`,
      { items: Probe },
      { permissions: ['organization:read', 'stock_item:read', 'stock_item:create'] },
    );
    await waitFor(() => expect(check.router.state.location.pathname).toBe(ITEMS));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });

  it('a member who edits stock opens Stock check', async () => {
    renderStockRoutes(`${ITEMS}/check`, { items: Probe }, { role: 'pharmacist' });
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent('action check'),
    );
    expect(notifyMock.info).not.toHaveBeenCalled();
  });
});
