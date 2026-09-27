import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MeContext } from '@/shared/tenancy/me-context.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { DashboardPage } from './DashboardPage.tsx';

const { useMeContextMock } = vi.hoisted(() => ({ useMeContextMock: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: useMeContextMock,
  meContextQueryKey: ['auth', 'me-context'],
}));

function ctx(): MeContext {
  return {
    user: {
      id: 'usr_x',
      email: 'ada@acme.test',
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
      id: 'org_x',
      name: 'Acme Inc.',
      slug: 'acme',
      type: 'TEAM',
      status: 'ACTIVE',
      logoUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    myPermissions: ['organization:read'],
    globalRole: null,
    organizations: [],
    deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    personalOrganizationId: null,
  };
}

describe('DashboardPage', () => {
  it('renders the shared Dashboard surface', async () => {
    useMeContextMock.mockReturnValue({
      data: ctx(),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
  });
});
