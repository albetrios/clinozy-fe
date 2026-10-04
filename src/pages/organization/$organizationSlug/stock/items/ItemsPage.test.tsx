import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../__tests__/integration/stock-test-router.tsx';
import { ItemsPage } from './ItemsPage.tsx';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('ItemsPage', () => {
  it('lists the items under the Clinic stock toolbar, ending with "All items loaded"', async () => {
    const { container } = renderStockRoutes('/organization/acme/stock/items', {
      items: ItemsPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-items-table-row')).toHaveLength(10),
    );
    expect(screen.getByTestId('stock-items-page')).toHaveTextContent('Soframycin 30 gm');
    expect(screen.getByTestId('stock-items-table-end')).toHaveTextContent(
      'All items loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'stock-items-tab-items',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
