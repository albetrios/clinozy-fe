import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { SuppliersPage } from './SuppliersPage.tsx';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('SuppliersPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All suppliers loaded"', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/suppliers', {
      suppliers: SuppliersPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-suppliers-table-row')).toHaveLength(4),
    );
    expect(screen.getByTestId('medical-suppliers-page')).toHaveTextContent('NH Pharma');
    expect(screen.getByTestId('medical-suppliers-table-end')).toHaveTextContent(
      'All suppliers loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-suppliers-tab-suppliers',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
