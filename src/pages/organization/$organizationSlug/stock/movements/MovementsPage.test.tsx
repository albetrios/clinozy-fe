import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../__tests__/integration/stock-test-router.tsx';
import { MovementsPage } from './MovementsPage.tsx';

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

describe('MovementsPage', () => {
  it('lists every entry with the payments, "7 entries" and the end line', async () => {
    const { container } = renderStockRoutes('/organization/acme/stock/movements', {
      movements: MovementsPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-movements-table-row')).toHaveLength(7),
    );
    expect(screen.getByTestId('stock-movements-page')).toHaveTextContent('Purchase #16');
    await waitFor(() =>
      expect(screen.getByTestId('stock-movements-table-footer')).toHaveTextContent(
        '7 entries',
      ),
    );
    expect(screen.getByTestId('stock-movements-table-end')).toHaveTextContent(
      'All movements loaded',
    );
    expect(screen.queryByTestId('stock-movements-new')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
