import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { MeContext } from '@/shared/tenancy/me-context.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { DashboardNextSteps } from './DashboardNextSteps.tsx';

function ctx(overrides: Partial<MeContext> = {}): MeContext {
  return {
    user: {
      id: 'usr_x',
      email: 'a@b.test',
      isEmailVerified: true,
      isMfaEnabled: false,
      firstName: 'Ada',
      lastName: null,
      avatarUrl: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    activeOrganization: {
      id: 'org_p',
      name: 'Personal',
      slug: null,
      type: 'PERSONAL',
      status: 'ACTIVE',
      logoUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    myPermissions: [],
    globalRole: null,
    organizations: [],
    ...overrides,
  };
}

describe('DashboardNextSteps', () => {
  it('renders priority action pills', async () => {
    renderWithProviders(<DashboardNextSteps ctx={ctx()} />);

    expect(await screen.findByTestId('dashboard-next-steps')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-next-billing')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-next-account')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<DashboardNextSteps ctx={ctx()} />);
    await screen.findByTestId('dashboard-next-steps');
    expect(await axe(container)).toHaveNoViolations();
  });
});
