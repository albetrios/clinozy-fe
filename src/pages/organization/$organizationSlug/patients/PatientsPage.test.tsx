import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderPatientsRoutes,
  resetPatientsRoutes,
} from './__tests__/integration/patients-test-router.tsx';
import { PatientsPage } from './PatientsPage.tsx';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetPatientsRoutes();
  resetClinicFixtures();
});

describe('PatientsPage', () => {
  it('renders the room — toolbar and table — with its title', async () => {
    const { container } = renderPatientsRoutes(
      '/organization/acme/patients',
      PatientsPage,
    );
    expect(await screen.findByTestId('patients-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Patients' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('patients-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('patients-table')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByTestId('patients-table-row').length).toBeGreaterThan(0),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the in-place skeleton while the first page loads', async () => {
    renderPatientsRoutes('/organization/acme/patients', PatientsPage);
    expect(await screen.findByTestId('skeleton-rows')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(screen.queryByTestId('skeleton-rows')).toBeNull());
  });
});
