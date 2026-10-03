import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PaymentsPage } from './PaymentsPage.tsx';

describe('PaymentsPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<PaymentsPage />);
    expect(await screen.findByTestId('payments-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
