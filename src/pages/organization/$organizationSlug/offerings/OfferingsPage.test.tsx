import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { OfferingsPage } from './OfferingsPage.tsx';

describe('OfferingsPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<OfferingsPage />);
    expect(await screen.findByTestId('offerings-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
