import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type { PlanAccess } from '@/shared/tenancy/me-context.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PlanAccessNotice } from './PlanAccessNotice.tsx';

const { useMeContextMock } = vi.hoisted(() => ({ useMeContextMock: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: useMeContextMock,
}));

const GRACE_ENDS_AT = '2026-10-31T12:00:00.000Z';

function givenPlanAccess(planAccess: PlanAccess) {
  useMeContextMock.mockReturnValue({ data: { activeOrganization: { planAccess } } });
}

function givenMember({
  permissions,
  organizationType = 'TEAM',
}: {
  permissions: OrganizationPermission[];
  organizationType?: 'TEAM' | 'PERSONAL';
}) {
  useOrganizationStore.setState({ permissions, organizationType });
}

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'usr_me', email: 'owner@clinic.test', role: 'user' } as AuthUser,
  });
  givenMember({ permissions: ['organization:read', 'subscription:manage'] });
});

afterEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ user: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('PlanAccessNotice', () => {
  it('shows nothing while the plan is active', async () => {
    givenPlanAccess({ state: 'active', graceEndsAt: null });
    renderWithProviders(<PlanAccessNotice />);
    // The router mounts the route asynchronously; let it settle before asserting absence.
    await act(async () => {});
    expect(screen.queryByTestId('plan-access-notice')).toBeNull();
  });

  it('shows nothing while me/context loads', async () => {
    useMeContextMock.mockReturnValue({ data: undefined });
    renderWithProviders(<PlanAccessNotice />);
    await act(async () => {});
    expect(screen.queryByTestId('plan-access-notice')).toBeNull();
  });

  it('names the day the records turn read-only during the grace period', async () => {
    givenPlanAccess({ state: 'grace', graceEndsAt: GRACE_ENDS_AT });
    const { container } = renderWithProviders(<PlanAccessNotice />);
    const notice = await screen.findByTestId('plan-access-notice');
    expect(notice).toHaveAttribute('data-slot', 'notice-pill');
    expect(notice).toHaveAttribute('data-state', 'grace');
    expect(notice).toHaveTextContent(
      /^Your clinic's plan isn't active\. Clinic records turn read-only on .*2026\./,
    );
    expect(notice).toHaveTextContent('31');
    expect(screen.getByTestId('plan-access-choose-plan')).toHaveTextContent(
      'Choose a plan',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says the records cannot be changed once read-only', async () => {
    givenPlanAccess({ state: 'read_only', graceEndsAt: null });
    const { container } = renderWithProviders(<PlanAccessNotice />);
    const notice = await screen.findByTestId('plan-access-notice');
    expect(notice).toHaveAttribute('data-state', 'read_only');
    expect(notice).toHaveTextContent(
      "Read-only — your clinic's plan isn't active, so records can't be changed. Choose a plan to unlock.",
    );
    expect(screen.getByTestId('plan-access-choose-plan')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens Settings › Billing on "Choose a plan"', async () => {
    const user = userEvent.setup();
    givenPlanAccess({ state: 'read_only', graceEndsAt: null });
    const { router } = renderWithProviders(<PlanAccessNotice />);
    await user.click(await screen.findByTestId('plan-access-choose-plan'));
    expect(router.state.location.hash).toBe('settings/account/billing');
  });

  it.each([
    ['a member who cannot manage the subscription', ['organization:read'], 'TEAM'],
    ['a personal workspace', ['subscription:manage'], 'PERSONAL'],
  ] as const)(
    'offers no plan choice to %s',
    async (_who, permissions, organizationType) => {
      givenMember({ permissions: [...permissions], organizationType });
      givenPlanAccess({ state: 'read_only', graceEndsAt: null });
      const { container } = renderWithProviders(<PlanAccessNotice />);
      expect(await screen.findByTestId('plan-access-notice')).toBeInTheDocument();
      expect(screen.queryByTestId('plan-access-choose-plan')).toBeNull();
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
