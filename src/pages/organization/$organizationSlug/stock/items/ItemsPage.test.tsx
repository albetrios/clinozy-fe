import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ItemsPage } from './ItemsPage.tsx';

describe('ItemsPage', () => {
  it('renders the tab with the room title', async () => {
    renderWithProviders(<ItemsPage />);
    expect(await screen.findByTestId('stock-items-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
