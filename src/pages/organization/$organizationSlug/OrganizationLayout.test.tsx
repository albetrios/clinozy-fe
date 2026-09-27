import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { OrganizationLayout } from './OrganizationLayout.tsx';

describe('OrganizationLayout', () => {
  it('mounts the shared AppLayout', async () => {
    renderWithProviders(<OrganizationLayout />);
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });
});
