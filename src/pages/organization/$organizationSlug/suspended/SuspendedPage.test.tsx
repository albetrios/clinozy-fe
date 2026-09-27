import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SuspendedPage } from './SuspendedPage.tsx';

describe('SuspendedPage', () => {
  it('renders the page container', async () => {
    renderWithProviders(<SuspendedPage />);
    expect(await screen.findByTestId('suspended-page')).toBeInTheDocument();
  });
});
