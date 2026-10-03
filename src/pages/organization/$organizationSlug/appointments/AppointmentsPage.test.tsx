import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AppointmentsPage } from './AppointmentsPage.tsx';

describe('AppointmentsPage', () => {
  it('renders the room with its title, on the Agenda by default (D27)', async () => {
    const { container } = renderWithProviders(<AppointmentsPage />);
    const page = await screen.findByTestId('appointments-page');
    expect(page).toHaveAttribute('data-view', 'agenda');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
