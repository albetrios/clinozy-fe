import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { SalesPage } from './SalesPage.tsx';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('SalesPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All sales loaded"', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/sales', {
      sales: SalesPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-sales-table-row')).toHaveLength(3),
    );
    expect(screen.getByTestId('medical-sales-page')).toHaveTextContent('Rhea Shah');
    expect(screen.getByTestId('medical-sales-table-end')).toHaveTextContent(
      'All sales loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-sales-tab-sales',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
