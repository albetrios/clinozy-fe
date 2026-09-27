import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { Boxes } from '@/shared/icons/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { DashboardKpiTile } from './DashboardStatCard.tsx';

describe('DashboardKpiTile', () => {
  it('renders label and numeric value', async () => {
    renderWithProviders(
      <DashboardKpiTile
        icon={Boxes}
        label="Workspaces"
        value={3}
        hint="You are a member"
        testId="dashboard-stat-workspaces"
      />,
    );

    expect(await screen.findByTestId('dashboard-stat-workspaces')).toBeInTheDocument();
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <DashboardKpiTile
        icon={Boxes}
        label="Workspaces"
        value={3}
        testId="dashboard-stat-workspaces"
      />,
    );
    await screen.findByTestId('dashboard-stat-workspaces');
    expect(await axe(container)).toHaveNoViolations();
  });
});
