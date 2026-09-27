import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { Settings } from '@/shared/icons/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { DashboardActionCard } from './DashboardActionCard.tsx';

describe('DashboardActionCard', () => {
  it('renders a linked action tile', async () => {
    renderWithProviders(
      <DashboardActionCard
        href="#settings/account/profile"
        icon={Settings}
        title="Your account"
        description="Profile and security"
        testId="dashboard-action-account"
      />,
    );

    const link = await screen.findByTestId('dashboard-action-account');
    expect(link).toHaveAttribute('href', '#settings/account/profile');
    expect(screen.getByText('Your account')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <DashboardActionCard
        href="#settings/account/profile"
        icon={Settings}
        title="Your account"
        description="Profile and security"
        testId="dashboard-action-account"
      />,
    );
    await screen.findByTestId('dashboard-action-account');
    expect(await axe(container)).toHaveNoViolations();
  });
});
