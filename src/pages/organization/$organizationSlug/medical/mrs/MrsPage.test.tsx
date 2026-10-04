import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { MrsPage } from './MrsPage.tsx';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('MrsPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All MRs loaded"', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/mrs', {
      mrs: MrsPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-mrs-table-row')).toHaveLength(3),
    );
    expect(screen.getByTestId('medical-mrs-page')).toHaveTextContent(
      'Alvio Pharma · Rakesh',
    );
    expect(screen.getByTestId('medical-mrs-table-end')).toHaveTextContent(
      'All MRs loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-mrs-tab-mrs',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
