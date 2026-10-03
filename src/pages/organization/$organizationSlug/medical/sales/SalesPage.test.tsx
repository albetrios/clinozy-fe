import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SalesPage } from './SalesPage.tsx';

describe('SalesPage', () => {
  it('renders the tab with the room title', async () => {
    renderWithProviders(<SalesPage />);
    expect(await screen.findByTestId('medical-sales-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
