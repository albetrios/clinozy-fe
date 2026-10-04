import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { fetchStockItem, stockQueryKeys } from '../../stock-api.ts';
import { useStockDialogRoute } from './useStockDialogRoute.ts';

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
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

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

    renderStockRoutes(`${ITEMS}/${ref.stockItem(167)}/edit`, { items: Probe });
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent(
        'record edit Soframycin 30 gm',
      ),
    );
  });

  it('goes back to the list, its search kept, with "Item not found" for an unknown id', async () => {
    const unknown = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';
    const { router } = renderStockRoutes(`${ITEMS}/${unknown}/edit?q=soft`, {
      items: Probe,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(ITEMS));
    expect(router.state.location.search).toMatchObject({ q: 'soft' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Item not found · it may have been deleted',
    );
  });

  it('a member who only uses stock is sent back from New item and Stock check', async () => {
    const create = renderStockRoutes(
      `${ITEMS}/create`,
      { items: Probe },
      { role: 'therapist' },
    );
    await waitFor(() => expect(create.router.state.location.pathname).toBe(ITEMS));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    create.unmount();

    const check = renderStockRoutes(
      `${ITEMS}/check`,
      { items: Probe },
      { role: 'therapist' },
    );
    await waitFor(() => expect(check.router.state.location.pathname).toBe(ITEMS));
    expect(screen.getByTestId('dialog')).toHaveTextContent('none');
    check.unmount();

    // A record still opens — view only.
    renderStockRoutes(
      `${ITEMS}/${ref.stockItem(167)}/edit`,
      { items: Probe },
      { role: 'therapist' },
    );
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent(
        'record edit Soframycin 30 gm',
      ),
    );
  });

  it('a member who keeps the stock opens Stock check', async () => {
    renderStockRoutes(`${ITEMS}/check`, { items: Probe }, { role: 'pharmacist' });
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent('action check'),
    );
    expect(notifyMock.info).not.toHaveBeenCalled();
  });
});
