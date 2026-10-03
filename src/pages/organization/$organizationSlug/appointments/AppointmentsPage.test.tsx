import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AppointmentsPage } from './AppointmentsPage.tsx';

describe('AppointmentsPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<AppointmentsPage />);
    expect(await screen.findByTestId('appointments-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
