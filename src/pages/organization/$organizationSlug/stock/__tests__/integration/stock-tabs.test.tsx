import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { ItemsPage } from '../../items/ItemsPage.tsx';
import { MovementsPage } from '../../movements/MovementsPage.tsx';
import { PurchasesPage } from '../../purchases/PurchasesPage.tsx';
import { VendorsPage } from '../../vendors/VendorsPage.tsx';
import { renderStockRoutes, resetStockRoutes } from './stock-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const PAGES = {
  items: ItemsPage,
  purchases: PurchasesPage,
  movements: MovementsPage,
  vendors: VendorsPage,
};
const ROOM = '/organization/acme/stock';

const rows = (tab: string) => screen.getAllByTestId(`stock-${tab}-table-row`);
const rowOf = (tab: string, text: string) => {
  const row = rows(tab).find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};

beforeEach(() => {
  viewport.tier = 'desktop';
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('Clinic stock › Items (KICKOFF §6.8)', () => {
  it('shows each item’s sub line, category, stock, runway, and no footer count', async () => {
    renderStockRoutes(`${ROOM}/items`, PAGES);
    await waitFor(() => expect(rows('items')).toHaveLength(10));
    const soframycin = rowOf('items', 'Soframycin 30 gm');
    expect(soframycin).toHaveTextContent('#167');
    expect(soframycin).toHaveTextContent('per tube of 30 g · uses ~0.5/week');
    expect(soframycin).toHaveTextContent('Creams & Serums');
    expect(soframycin).toHaveTextContent('3 tube · 90 g · OK');
    expect(soframycin).toHaveTextContent('~6 weeks');
    expect(rowOf('items', 'D-Tan Mask')).toHaveTextContent('Out');
    // "Supplier" is hidden by default (H:4160).
    expect(screen.getByTestId('stock-items-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 3 of 4 shown',
    );
    expect(screen.getByTestId('stock-items-table-footer')).not.toHaveTextContent(/items/);
  });

  it('filters Low stock and a category through the URL; a row opens Edit item', async () => {
    const user = userEvent.setup();
    const { router } = renderStockRoutes(`${ROOM}/items?stock=low`, PAGES);
    await waitFor(() => expect(rows('items')).toHaveLength(2));
    await router.navigate({ to: `${ROOM}/items`, search: { category: ['masks'] } });
    await waitFor(() => expect(rows('items')).toHaveLength(1));
    await user.click(within(rowOf('items', 'D-Tan Mask')).getByText('D-Tan Mask'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/items/${ref.stockItem(161)}/edit`,
      ),
    );
    expect(router.state.location.search).toMatchObject({ category: ['masks'] });
  });

  it('offers the automatic Category and Lasts sections in Filters', async () => {
    const user = userEvent.setup();
    renderStockRoutes(`${ROOM}/items`, PAGES);
    await waitFor(() => expect(rows('items')).toHaveLength(10));
    await user.click(screen.getByTestId('stock-items-filters-trigger'));
    const panel = await screen.findByTestId('stock-items-filters');
    expect(within(panel).getByText('Low stock')).toBeVisible();
    await waitFor(() =>
      expect(within(panel).getByText('Peels & Neutralisers')).toBeVisible(),
    );
    expect(within(panel).getByText('~27 weeks')).toBeVisible();
  });

  it('sorts by a column header through the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderStockRoutes(`${ROOM}/items`, PAGES);
    await waitFor(() => expect(rows('items')).toHaveLength(10));
    await user.click(screen.getByTitle('Sort by Lasts'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'lasts:asc' }),
    );
    await waitFor(() => expect(rows('items')[0]).toHaveTextContent('D-Tan Mask'));
  });

  it('shows the filtered empty state, and clears it', async () => {
    const user = userEvent.setup();
    // Low stock among the consumables: none (the low items are a mask and a peel).
    renderStockRoutes(`${ROOM}/items?stock=low&category=consumables`, PAGES);
    expect(await screen.findByText('No matches')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    await waitFor(() => expect(rows('items')).toHaveLength(10));
  });

  it('keeps rows on a phone: the Category is the key, Stock and Lasts fold', async () => {
    viewport.tier = 'phone';
    renderStockRoutes(`${ROOM}/items`, PAGES);
    await waitFor(() => expect(rows('items')).toHaveLength(10));
    const row = rowOf('items', 'Soframycin 30 gm');
    expect(row).toHaveTextContent('Creams & Serums');
    expect(row).toHaveTextContent('3 tube · 90 g · OK');
  });
});

describe('Clinic stock › Purchases', () => {
  it('shows the bill, what is due and the status; a row opens Edit purchase', async () => {
    const user = userEvent.setup();
    const { router } = renderStockRoutes(`${ROOM}/purchases?status=unpaid`, PAGES);
    await waitFor(() => expect(rows('purchases')).toHaveLength(1));
    const unpaid = rowOf('purchases', 'Cranix Pharma');
    expect(unpaid).toHaveTextContent('#15');
    expect(unpaid).toHaveTextContent('₹1,710');
    expect(unpaid).toHaveTextContent('Unpaid');
    await user.click(within(unpaid).getByText('Cranix Pharma'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/purchases/${ref.stockPurchase(15)}/edit`,
      ),
    );
  });
});

describe('Clinic stock › Movements', () => {
  it('reads each change and payment, struck through once reverted', async () => {
    const [first] = clinicFixtures.stockMovements.snapshot();
    if (!first) throw new Error('no movement');
    await clinicFixtures.stockMovements.update(first.id, { revertedById: first.id });
    renderStockRoutes(`${ROOM}/movements`, PAGES);
    await waitFor(() => expect(rows('movements')).toHaveLength(7));
    const used = rowOf('movements', 'LHR · Dharti Galani');
    expect(used).toHaveTextContent('Noprik Plus numbing cream 50 gm');
    expect(used).toHaveTextContent('− 1 tube');
    expect(used).toHaveTextContent('Reverted');
    const payment = rowOf('movements', 'Purchase #16 · SW-77');
    expect(payment).toHaveTextContent('Payment');
    expect(payment).toHaveTextContent('− ₹600');
    expect(payment).toHaveTextContent('Riya S.');
    expect(rowOf('movements', 'Water bottles')).toHaveTextContent('+ 24 bottle');
  });
});

describe('Clinic stock access (Q-K2)', () => {
  it('lets the Accountant read the stock without a create', async () => {
    renderStockRoutes(`${ROOM}/items`, PAGES, { role: 'accountant' });
    await waitFor(() => expect(rows('items')).toHaveLength(10));
    expect(screen.queryByTestId('stock-items-new')).toBeNull();
  });
});
