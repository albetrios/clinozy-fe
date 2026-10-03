import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { LeadsPage } from './LeadsPage.tsx';

describe('LeadsPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<LeadsPage />);
    expect(await screen.findByTestId('leads-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
