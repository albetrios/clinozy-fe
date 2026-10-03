import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { UsersPage } from './UsersPage.tsx';

describe('UsersPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<UsersPage />);
    expect(await screen.findByTestId('users-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
