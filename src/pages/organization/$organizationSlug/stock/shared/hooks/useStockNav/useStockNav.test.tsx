import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { useStockNav } from './useStockNav.ts';

const ROOM = '/organization/acme/stock';
const ID = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';

/** Buttons that run the hook's navigations. */
function Probe() {
  const nav = useStockNav();
  return (
    <>
      <button type="button" onClick={() => nav.itemEdit(ID)}>
        edit item
      </button>
      <button type="button" onClick={() => nav.check()}>
        check
      </button>
      <button type="button" onClick={() => nav.close('items')}>
        close
      </button>
      <button type="button" onClick={() => nav.create('purchases', { reorder: 'low' })}>
        reorder
      </button>
      <button type="button" onClick={() => nav.purchaseEdit(ID)}>
        edit purchase
      </button>
      <button type="button" onClick={() => nav.vendorEdit(ID)}>
        edit vendor
      </button>
    </>
  );
}

afterEach(() => resetStockRoutes());

describe('useStockNav', () => {
  it('opens each dialog route over its tab, keeping the list’s params', async () => {
    const user = userEvent.setup();
    const { router } = renderStockRoutes(`${ROOM}/items?category=masks`, {
      items: Probe,
    });
    await user.click(await screen.findByRole('button', { name: 'edit item' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/items/${ID}/edit`),
    );
    expect(router.state.location.search).toMatchObject({ category: ['masks'] });
    await user.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/items`));
    expect(router.state.location.search).toMatchObject({ category: ['masks'] });
    await user.click(screen.getByRole('button', { name: 'check' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/items/check`),
    );
  });

  it('opens a create over its own tab with its prefill, and the edits over theirs', async () => {
    const user = userEvent.setup();
    const { router } = renderStockRoutes(`${ROOM}/items`, { items: Probe });
    await user.click(await screen.findByRole('button', { name: 'reorder' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/create`),
    );
    expect(router.state.location.search).toMatchObject({ reorder: 'low' });

    await router.navigate({ to: `${ROOM}/items` });
    await user.click(await screen.findByRole('button', { name: 'edit purchase' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/${ID}/edit`),
    );
    await router.navigate({ to: `${ROOM}/items` });
    await user.click(await screen.findByRole('button', { name: 'edit vendor' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/vendors/${ID}/edit`),
    );
  });
});
