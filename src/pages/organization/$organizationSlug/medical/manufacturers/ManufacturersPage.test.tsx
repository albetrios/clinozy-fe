import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { ManufacturersPage } from './ManufacturersPage.tsx';

beforeEach(() => resetAppFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('ManufacturersPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All manufacturers loaded"', async () => {
    const { container } = renderMedicalRoutes(
      '/organization/acme/medical/manufacturers',
      {
        manufacturers: ManufacturersPage,
      },
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-manufacturers-table-row')).toHaveLength(6),
    );
    expect(screen.getByTestId('medical-manufacturers-page')).toHaveTextContent('ALVI');
    expect(screen.getByTestId('medical-manufacturers-table-end')).toHaveTextContent(
      'All manufacturers loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-manufacturers-tab-manufacturers',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
