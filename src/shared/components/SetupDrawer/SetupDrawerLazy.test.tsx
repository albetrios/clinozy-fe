import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppSplashModule from '@/lib/app-splash.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

// This suite tests the host — hash gating, the chunk, the auto-open — not the drawer itself
// (SetupDrawer.test.tsx covers it).
vi.mock('./SetupDrawer.tsx', () => ({
  SetupDrawer: () => (
    <div role="dialog" aria-label="Clinic setup" data-testid="setup-drawer-stub" />
  ),
}));

const access = vi.hoisted(() => ({
  canManageSetup: true,
  isResolved: true,
  setup: undefined as OnboardingSetup | undefined,
  invalidation: vi.fn(),
}));
vi.mock('@/shared/hooks/useOnboardingSetup/index.ts', () => ({
  useSetupAccess: () => ({
    canManageSetup: access.canManageSetup,
    isResolved: access.isResolved,
  }),
  useOnboardingSetup: () => ({ data: access.setup }),
  useSetupInvalidation: access.invalidation,
}));

// The boot splash is long gone in a test: the auto-open runs at once.
const splash = vi.hoisted(() => ({ dismissed: vi.fn() }));
vi.mock('@/lib/app-splash.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppSplashModule>()),
  onAppSplashDismissed: (callback: () => void) => {
    splash.dismissed();
    callback();
    return () => undefined;
  },
}));

const { startedMock } = vi.hoisted(() => ({ startedMock: vi.fn() }));
vi.mock('./setup-analytics.ts', () => ({ setupEvents: { started: startedMock } }));

import { SetupDrawerLazy } from './SetupDrawerLazy.tsx';

/** A clinic's setup, not live and not deferred unless the overrides say so. */
function setupOf(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return {
    answeredSteps: [],
    skippedItems: [],
    mainBranchId: null,
    nextStep: 'clinic_type',
    liveChecks: { clinic_type: false, main_branch: false, services: false },
    isLive: false,
    hasSomeoneToBook: false,
    guideItems: [],
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

beforeEach(() => {
  vi.resetAllMocks();
  access.canManageSetup = true;
  access.isResolved = true;
  access.setup = undefined;
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
});

describe('SetupDrawerLazy', () => {
  it('renders nothing without #setup', async () => {
    const { container, router } = renderWithProviders(<SetupDrawerLazy />);
    await act(async () => {});
    expect(screen.queryByTestId('setup-drawer-stub')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    expect(router.state.location.hash).toBe('');
    // The host keeps the setup fresh whether or not the drawer is open.
    expect(access.invalidation).toHaveBeenCalled();
  });

  it('loads the drawer at #setup for a manager', async () => {
    renderWithProviders(<SetupDrawerLazy />, { initialEntries: ['/#setup/location'] });
    const drawer = await screen.findByTestId('setup-drawer-stub');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('drops a member’s #setup once access is known', async () => {
    access.canManageSetup = false;
    const { router } = renderWithProviders(<SetupDrawerLazy />, {
      initialEntries: ['/#setup'],
    });
    await waitFor(() => expect(router.state.location.hash).toBe(''));
    expect(screen.queryByTestId('setup-drawer-stub')).not.toBeInTheDocument();
  });

  it('keeps the address while access is not known yet', async () => {
    access.canManageSetup = false;
    access.isResolved = false;
    const { router } = renderWithProviders(<SetupDrawerLazy />, {
      initialEntries: ['/#setup'],
    });
    await act(async () => {});
    expect(router.state.location.hash).toBe('setup');
    expect(screen.queryByTestId('setup-drawer-stub')).not.toBeInTheDocument();
  });

  it('opens by itself once for a clinic neither live nor deferred, after the splash', async () => {
    access.setup = setupOf();
    const { router } = renderWithProviders(<SetupDrawerLazy />, {
      initialEntries: ['/?view=week'],
    });

    await waitFor(() => expect(router.state.location.hash).toBe('setup'));
    expect(router.state.location.search).toEqual({ view: 'week' });
    expect(splash.dismissed).toHaveBeenCalled();
    expect(startedMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('setup-drawer-stub')).toBeInTheDocument();

    // Closed (the drawer defers it on the server meanwhile): it never comes back by itself.
    await act(async () => {
      await router.navigate({ to: '.', hash: '', replace: true });
    });
    await act(async () => {});
    expect(router.state.location.hash).toBe('');
    expect(startedMock).toHaveBeenCalledTimes(1);
  });

  it('never opens by itself for a live clinic', async () => {
    access.setup = setupOf({ isLive: true, nextStep: null });
    const { router } = renderWithProviders(<SetupDrawerLazy />);
    await act(async () => {});
    expect(router.state.location.hash).toBe('');
    expect(startedMock).not.toHaveBeenCalled();
  });

  it('never opens by itself for a clinic that chose “Explore first”', async () => {
    access.setup = setupOf({ deferredAt: '2026-10-13T04:40:00Z' });
    const { router } = renderWithProviders(<SetupDrawerLazy />);
    await act(async () => {});
    expect(router.state.location.hash).toBe('');
    expect(startedMock).not.toHaveBeenCalled();
  });

  it('never opens by itself for a member', async () => {
    access.canManageSetup = false;
    access.setup = setupOf();
    const { router } = renderWithProviders(<SetupDrawerLazy />);
    await act(async () => {});
    expect(router.state.location.hash).toBe('');
    expect(startedMock).not.toHaveBeenCalled();
  });

  it('never opens over another dialog', async () => {
    const other = document.createElement('div');
    other.setAttribute('role', 'dialog');
    document.body.append(other);
    try {
      access.setup = setupOf();
      const { router } = renderWithProviders(<SetupDrawerLazy />);
      await act(async () => {});
      expect(router.state.location.hash).toBe('');
      expect(startedMock).not.toHaveBeenCalled();
    } finally {
      other.remove();
    }
  });
});
