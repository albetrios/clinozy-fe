import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { TodayPage } from './TodayPage.tsx';

describe('TodayPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<TodayPage />);
    expect(await screen.findByTestId('today-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
