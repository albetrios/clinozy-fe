import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientsPage } from './PatientsPage.tsx';

describe('PatientsPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<PatientsPage />);
    expect(await screen.findByTestId('patients-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
