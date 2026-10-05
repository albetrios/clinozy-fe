import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../__tests__/integration/stock-test-router.tsx';
import { VendorsPage } from './VendorsPage.tsx';

// The footer (its count) shows from `md`; a phone hides it.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

const ROOM = '/organization/acme/stock';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('VendorsPage (Q-K1)', () => {
  it('lists the vendors, their purchases and payable, the count and the end line', async () => {
    const { container } = renderStockRoutes(`${ROOM}/vendors`, { vendors: VendorsPage });
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-vendors-table-row')).toHaveLength(5),
    );
    await waitFor(() =>
      expect(screen.getByTestId('stock-vendors-table-footer')).toHaveTextContent(
        '5 vendors · ₹2,310 payable',
      ),
    );
    expect(screen.getByTestId('stock-vendors-table-end')).toHaveTextContent(
      'All vendors loaded',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens Edit clinic vendor from a row, and shows the plain empty state for a search', async () => {
    const user = userEvent.setup();
    const { router } = renderStockRoutes(`${ROOM}/vendors`, { vendors: VendorsPage });
    await user.click(await screen.findByText('Cranix Pharma'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/vendors/${ref.stockVendor(2)}/edit`,
      ),
    );
    await router.navigate({ to: `${ROOM}/vendors`, search: { q: 'nobody' } });
    expect(await screen.findByText('No vendor matches')).toBeVisible();
    expect(
      within(screen.getByTestId('empty-state')).getByRole('button', {
        name: 'New clinic vendor',
      }),
    ).toBeVisible();
  });

  it('"Pay ₹X" while a vendor is owed opens Send payment on their oldest open purchase', async () => {
    const user = userEvent.setup();
    const { router } = renderStockRoutes(`${ROOM}/vendors`, { vendors: VendorsPage });
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-vendors-row-action-pay')).toHaveLength(2),
    );
    const pay = screen
      .getAllByTestId('stock-vendors-row-action-pay')
      .find((button) => button.getAttribute('aria-label') === 'Pay ₹1,710');
    await user.click(pay as HTMLElement);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments/pay'),
    );
    expect(router.state.location.search).toEqual({
      bill: `is:${ref.stockPurchase(15)}`,
    });
  });
});
