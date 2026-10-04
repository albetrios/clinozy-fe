import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { useStockAccess } from '../../hooks/useStockAccess/index.ts';
import { StockToolbar } from './StockToolbar.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const ROOM = '/organization/acme/stock';

/** Marks the moment the member's access has answered. */
function AccessResolved() {
  return useStockAccess().resolved ? <span data-testid="access-resolved" /> : null;
}
const PAGES = {
  items: () => <StockToolbar tab="items" />,
  purchases: () => <StockToolbar tab="purchases" />,
  movements: () => <StockToolbar tab="movements" />,
  vendors: () => <StockToolbar tab="vendors" />,
};

beforeEach(() => {
  viewport.tier = 'desktop';
});
afterEach(() => resetStockRoutes());

describe('StockToolbar', () => {
  it('carries the h1, the four tabs, Stock check and "+ New item" on Items', async () => {
    const user = userEvent.setup();
    const { container, router } = renderStockRoutes(`${ROOM}/items`, PAGES);
    expect(await screen.findByTestId('stock-items-new')).toHaveTextContent('New item');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Clinic stock');
    const nav = screen.getByRole('navigation', { name: 'Clinic stock sections' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Items', 'Purchases', 'Movements', 'Vendors']);
    expect(within(nav).getByRole('link', { current: 'page' })).toHaveTextContent('Items');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByTestId('stock-items-view-action-check'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/items/check`),
    );
    await user.click(screen.getByTestId('stock-items-new'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/items/create`),
    );
  });

  it('names the Purchases create, with Stock check left on Items', async () => {
    renderStockRoutes(`${ROOM}/purchases`, PAGES);
    expect(await screen.findByTestId('stock-purchases-new')).toHaveTextContent(
      'New purchase',
    );
    expect(screen.queryByTestId('stock-purchases-view-action-check')).toBeNull();
  });

  it('offers no create on Movements and "New clinic vendor" on Vendors', async () => {
    const { unmount } = renderStockRoutes(`${ROOM}/movements`, PAGES);
    await screen.findByRole('navigation', { name: 'Clinic stock sections' });
    expect(screen.queryByTestId('stock-movements-new')).toBeNull();
    unmount();
    renderStockRoutes(`${ROOM}/vendors`, PAGES);
    expect(await screen.findByTestId('stock-vendors-new')).toHaveTextContent(
      'New clinic vendor',
    );
  });

  it('puts Stock check in the tabs’ row on a phone', async () => {
    viewport.tier = 'phone';
    renderStockRoutes(`${ROOM}/items`, PAGES);
    const nav = await screen.findByRole('navigation', { name: 'Clinic stock sections' });
    expect(nav.parentElement).toContainElement(
      await screen.findByTestId('stock-items-view-action-check'),
    );
  });

  it('hides the creates and Stock check from those who only use stock (Q-K2)', async () => {
    renderStockRoutes(
      `${ROOM}/items`,
      {
        items: () => (
          <>
            <StockToolbar tab="items" />
            <AccessResolved />
          </>
        ),
      },
      { role: 'therapist' },
    );
    await screen.findByTestId('access-resolved');
    expect(screen.queryByTestId('stock-items-new')).toBeNull();
    expect(screen.queryByTestId('stock-items-view-action-check')).toBeNull();
  });
});
