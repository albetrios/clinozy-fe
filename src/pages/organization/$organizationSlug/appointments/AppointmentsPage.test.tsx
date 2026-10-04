import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { grantClinicAccess } from './__tests__/integration/appointments-test-router.tsx';
import { AppointmentsPage } from './AppointmentsPage.tsx';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  grantClinicAccess('owner');
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('AppointmentsPage', () => {
  it('renders the room: its toolbar, then the Agenda by default (D27)', async () => {
    const { container } = renderWithProviders(<AppointmentsPage />);
    const page = await screen.findByTestId('appointments-page');
    expect(page).toHaveAttribute('data-view', 'agenda');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Appointments');
    expect(screen.getByRole('tabpanel', { name: 'Agenda' })).toContainElement(
      await screen.findByTestId('appointments-table'),
    );
    await screen.findAllByTestId('appointments-table-row');
    expect(await axe(container)).toHaveNoViolations();
  });
});
