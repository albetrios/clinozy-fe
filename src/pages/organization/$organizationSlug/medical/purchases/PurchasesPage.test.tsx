import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { PurchasesPage } from './PurchasesPage.tsx';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('PurchasesPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All purchase orders loaded"', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/purchases', {
      purchases: PurchasesPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-purchases-table-row')).toHaveLength(3),
    );
    expect(screen.getByTestId('medical-purchases-page')).toHaveTextContent(
      'K R Medical Agency',
    );
    expect(screen.getByTestId('medical-purchases-table-end')).toHaveTextContent(
      'All purchase orders loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-purchases-tab-purchases',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
