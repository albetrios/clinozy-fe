import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../__tests__/integration/stock-test-router.tsx';
import { PurchasesPage } from './PurchasesPage.tsx';

// The footer (its count) shows from `md`; a phone hides it.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('PurchasesPage', () => {
  it('lists the bills with what is due, the count and the end line', async () => {
    const { container } = renderStockRoutes('/organization/acme/stock/purchases', {
      purchases: PurchasesPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-purchases-table-row')).toHaveLength(4),
    );
    expect(screen.getByTestId('stock-purchases-page')).toHaveTextContent('Cranix Pharma');
    await waitFor(() =>
      expect(screen.getByTestId('stock-purchases-table-footer')).toHaveTextContent(
        '4 purchases · ₹2,310 due',
      ),
    );
    expect(screen.getByTestId('stock-purchases-table-end')).toHaveTextContent(
      'All purchases loaded',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
