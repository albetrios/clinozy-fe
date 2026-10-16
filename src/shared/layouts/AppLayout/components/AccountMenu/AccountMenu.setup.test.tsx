import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as OnboardingSetupApiModule from '@/shared/api/app/onboarding-setup-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import type * as PresenceApiModule from '@/shared/api/app/presence-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { presetMyRoles } from '@/tests/utils/app-preset-codes.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AccountMenu } from './AccountMenu.tsx';

/*
 * The clinic setup's additions to the Account menu (feat-clinic-setup D28): the avatar's progress
 * ring, "Finish setup · n of 5" and "Clinic settings" — read through the real setup hooks over a
 * mocked `GET /app/onboarding-setup`.
 */

const { fetchSetupMock } = vi.hoisted(() => ({ fetchSetupMock: vi.fn() }));
vi.mock('@/shared/api/app/onboarding-setup-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OnboardingSetupApiModule>()),
  fetchOnboardingSetup: fetchSetupMock,
}));
vi.mock('@/shared/api/app/presence-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PresenceApiModule>()),
  fetchMyPresence: async () => 'online',
  saveMyPresence: async (next: string) => next,
}));
vi.mock('@/shared/auth/service.ts', () => ({ logout: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: { myRoles: presetMyRoles('owner') } }),
}));
vi.mock('@/shared/components/OrganizationSwitcher/index.ts', () => ({
  OrganizationSwitcher: () => null,
}));
vi.mock('@/shared/tenancy/my-invitations.ts', () => ({
  useMyInvitations: () => ({ data: [] }),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

/** A clinic's setup, not live, with no step done unless the overrides say otherwise. */
function setupOf(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return {
    answeredSteps: [],
    skippedItems: [],
    mainBranchId: null,
    nextStep: 'clinic_type',
    liveChecks: { clinic_type: false, main_branch: false, services: false },
    isLive: false,
    hasSomeoneToBook: false,
    guideItems: [
      { key: 'treatments', isDone: false, isSkipped: false, canSkip: true },
      { key: 'invite_team', isDone: false, isSkipped: false, canSkip: true },
      { key: 'first_appointment', isDone: false, isSkipped: false, canSkip: false },
    ],
    guideDoneCount: 0,
    guideTotalCount: 3,
    deferredAt: null,
    completedAt: null,
    guideHiddenAt: null,
    guideDoneAt: null,
    completedByMembershipId: null,
    updatedAt: '2026-10-13T04:30:00Z',
    ...overrides,
  };
}

const LIVE: Partial<OnboardingSetup> = {
  answeredSteps: ['clinic_type', 'you'],
  liveChecks: { clinic_type: true, main_branch: true, services: true },
  isLive: true,
  nextStep: null,
  completedByMembershipId: 'mem_owneraaaaaaaaaaaaaaaa',
};

/** A manager of a team clinic (`organization:update`). */
function signInManager() {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.setState({ organizationType: 'TEAM' });
  useOrganizationStore
    .getState()
    .setPermissions(['organization:read', 'organization:update']);
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(await screen.findByTestId('user-menu-trigger'));
  return { user, menu: await screen.findByRole('menu', { name: 'Account' }) };
}

/** The avatar once the setup has been read. */
async function renderMenu() {
  const view = renderWithProviders(<AccountMenu onOpenNotifications={vi.fn()} />);
  await screen.findByTestId('user-menu-trigger');
  return view;
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    user: {
      id: 'usr_1',
      email: 'riya@acme.test',
      name: 'Riya Shah',
      role: 'user',
    } as AuthUser,
  });
  useOrganizationStore.getState().clearOrganization();
  useUIStore.setState({ previewRole: null });
  signInManager();
  fetchSetupMock.mockResolvedValue(
    setupOf({
      answeredSteps: ['clinic_type'],
      liveChecks: { clinic_type: true, main_branch: false, services: false },
    }),
  );
});

describe('AccountMenu — the clinic setup', () => {
  it('rings the avatar with the questions answered and says so in its name', async () => {
    await renderMenu();

    expect(await screen.findByTestId('user-menu-setup-ring')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu-trigger')).toHaveAccessibleName(
      'Riya Shah · Online · Setup 1 of 5 done',
    );
  });

  it('opens the drawer from “Finish setup · n of 5”', async () => {
    const { router } = await renderMenu();
    await screen.findByTestId('user-menu-setup-ring');
    const { user, menu } = await openMenu();

    const row = within(menu).getByTestId('account-menu-finish-setup');
    expect(row).toHaveTextContent('Finish setup · 1 of 5');
    await user.click(row);

    await waitFor(() => expect(router.state.location.hash).toBe('setup'));
  });

  it('opens Settings › Clinic from “Clinic settings”', async () => {
    const { router } = await renderMenu();
    const { user, menu } = await openMenu();

    await user.click(within(menu).getByTestId('account-menu-clinic-settings'));

    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/organization/clinic'),
    );
  });

  it('counts the guide’s items once live', async () => {
    fetchSetupMock.mockResolvedValue(setupOf({ ...LIVE, guideDoneCount: 2 }));
    await renderMenu();
    await screen.findByTestId('user-menu-setup-ring');
    const { menu } = await openMenu();

    expect(within(menu).getByTestId('account-menu-finish-setup')).toHaveTextContent(
      'Finish setup · 2 of 3',
    );
  });

  it('drops the ring and the row once the guide is done, keeping Clinic settings', async () => {
    fetchSetupMock.mockResolvedValue(
      setupOf({ ...LIVE, guideDoneCount: 3, guideDoneAt: '2026-10-13T06:00:00Z' }),
    );
    await renderMenu();
    await waitFor(() => expect(fetchSetupMock).toHaveBeenCalled());
    // The answer lands before anything is read off it.
    await act(async () => {});
    const { menu } = await openMenu();

    expect(screen.queryByTestId('user-menu-setup-ring')).not.toBeInTheDocument();
    expect(
      within(menu).queryByTestId('account-menu-finish-setup'),
    ).not.toBeInTheDocument();
    expect(within(menu).getByTestId('account-menu-clinic-settings')).toBeInTheDocument();
  });

  it('never rings for a clinic live before setup shipped (D7)', async () => {
    fetchSetupMock.mockResolvedValue(setupOf({ ...LIVE, completedByMembershipId: null }));
    await renderMenu();
    await waitFor(() => expect(fetchSetupMock).toHaveBeenCalled());
    // The answer lands before anything is read off it.
    await act(async () => {});

    expect(screen.queryByTestId('user-menu-setup-ring')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-menu-trigger')).toHaveAccessibleName(
      'Riya Shah · Online',
    );
  });

  it('shows a member neither the ring nor the rows, and reads no setup', async () => {
    useOrganizationStore.getState().setPermissions(['organization:read']);
    await renderMenu();
    const { menu } = await openMenu();

    expect(screen.queryByTestId('user-menu-setup-ring')).not.toBeInTheDocument();
    expect(
      within(menu).queryByTestId('account-menu-finish-setup'),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByTestId('account-menu-clinic-settings'),
    ).not.toBeInTheDocument();
    expect(fetchSetupMock).not.toHaveBeenCalled();
  });

  it('shows nothing of setup in a personal workspace', async () => {
    useOrganizationStore.setState({ organizationType: 'PERSONAL' });
    await renderMenu();
    const { menu } = await openMenu();

    expect(
      within(menu).queryByTestId('account-menu-clinic-settings'),
    ).not.toBeInTheDocument();
    expect(fetchSetupMock).not.toHaveBeenCalled();
  });

  it('has no axe violations with the setup rows', async () => {
    await renderMenu();
    await screen.findByTestId('user-menu-setup-ring');
    const { menu } = await openMenu();
    expect(within(menu).getByTestId('account-menu-finish-setup')).toBeInTheDocument();
    expect(await axe(menu)).toHaveNoViolations();
  });
});
