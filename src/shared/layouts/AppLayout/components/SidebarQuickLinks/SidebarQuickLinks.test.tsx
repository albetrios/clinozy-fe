import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SidebarQuickLinks } from './SidebarQuickLinks.tsx';

describe('SidebarQuickLinks', () => {
  it('renders search and settings actions', async () => {
    renderWithProviders(<SidebarQuickLinks />);

    expect(await screen.findByTestId('sidebar-quick-links')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-search')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-settings')).toBeInTheDocument();
  });

  it('opens the command palette from search', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ commandPaletteOpen: false });
    renderWithProviders(<SidebarQuickLinks />);

    await user.click(await screen.findByTestId('sidebar-search'));
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<SidebarQuickLinks />);
    await screen.findByTestId('sidebar-quick-links');
    expect(await axe(container)).toHaveNoViolations();
  });
});
