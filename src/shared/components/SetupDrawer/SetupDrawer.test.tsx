import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import type * as AppRolesModule from '@/shared/hooks/useAppRoles/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const state = vi.hoisted(() => ({
  setup: undefined as OnboardingSetup | undefined,
  profile: undefined as ClinicProfile | undefined,
  changeMutate: vi.fn(),
  changeMutateAsync: vi.fn(),
  updateProfileMutateAsync: vi.fn(),
}));
vi.mock('@/shared/hooks/useOnboardingSetup/index.ts', () => ({
  useOnboardingSetup: () => ({ data: state.setup }),
  useChangeOnboardingSetup: () => ({
    mutate: state.changeMutate,
    mutateAsync: state.changeMutateAsync,
    isPending: false,
  }),
}));
vi.mock('@/shared/hooks/useClinicProfile/index.ts', () => ({
  useClinicProfile: () => ({ data: state.profile }),
  useUpdateClinicProfile: () => ({
    mutateAsync: state.updateProfileMutateAsync,
    isPending: false,
  }),
}));
vi.mock('@/shared/hooks/useHoursFormat/index.ts', () => ({
  useHoursFormat: () => ({
    weekday: (day: string) => day,
    days: (days: readonly string[]) => days.join(', '),
    hours: (days: readonly string[], from: string, to: string) =>
      `${days.join(', ')} · ${from}–${to}`,
    updated: (instant: string) => instant,
  }),
}));
vi.mock('@/shared/hooks/useOfferings/index.ts', () => ({
  useOfferings: () => ({ data: [] }),
  useCreateOffering: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/shared/components/OfferingQuickCreate/index.ts', () => ({
  OfferingQuickCreate: () => null,
}));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: undefined }),
}));
vi.mock('@/shared/hooks/useAppRoles/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppRolesModule>()),
  useAppRoles: () => ({
    roles: [],
    byId: new Map(),
    label: (role: { name: string }) => role.name,
    labelOf: () => '',
    toneOf: () => 'stone',
    isPending: false,
  }),
  useRolesInForce: () => [],
}));
vi.mock('./setup-analytics.ts', () => ({
  setupEvents: {
    started: vi.fn(),
    stepCompleted: vi.fn(),
    live: vi.fn(),
    deferred: vi.fn(),
    guideItem: vi.fn(),
    guideHidden: vi.fn(),
    firstAppointmentBooked: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { setupEvents } from './setup-analytics.ts';
import { SetupDrawer } from './SetupDrawer.tsx';

const PROFILE: ClinicProfile = {
  name: 'Acme Skin Clinic',
  specialties: ['skin'],
  timezone: 'Asia/Kolkata',
  createdAt: '2026-10-01T04:30:00Z',
  updatedAt: '2026-10-13T04:30:00Z',
};

/** A clinic's setup at its start, unless the overrides say otherwise. */
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
  mainBranchId: 'brn_mainaaaaaaaaaaaaaaaaa',
  nextStep: null,
  isLive: true,
  completedAt: '2026-10-13T05:00:00Z',
  completedByMembershipId: 'mem_owneraaaaaaaaaaaaaaaa',
};

function renderAt(hash: string) {
  return renderWithProviders(<SetupDrawer />, { initialEntries: [`/#${hash}`] });
}

beforeEach(() => {
  vi.resetAllMocks();
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  state.setup = setupOf();
  state.profile = PROFILE;
  state.changeMutateAsync.mockResolvedValue(setupOf());
  state.updateProfileMutateAsync.mockResolvedValue(PROFILE);
});

describe('SetupDrawer — the three steps', () => {
  it('opens the first step, names the clinic and counts the steps, later steps locked', async () => {
    const { router } = renderAt('setup');

    await waitFor(() => expect(router.state.location.hash).toBe('setup/clinic-type'));
    const drawer = await screen.findByTestId('setup-drawer');
    expect(within(drawer).getByTestId('setup-drawer-title')).toHaveTextContent(
      'Set up Acme Skin Clinic',
    );
    expect(within(drawer).getByText('About a minute · Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('setup-drawer-step-announce')).toHaveTextContent(
      'Step 1 of 3',
    );

    expect(
      screen.getByTestId('setup-drawer-step-clinic-type-trigger'),
    ).not.toHaveAttribute('aria-disabled');
    for (const step of ['location', 'you']) {
      expect(screen.getByTestId(`setup-drawer-step-${step}-trigger`)).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    expect(screen.getByTestId('setup-drawer-step-location')).toHaveTextContent(
      'After “What kind of clinic is it?”',
    );
    expect(screen.getByTestId('setup-drawer-save')).toHaveTextContent(
      'Next: Where is your clinic?',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('says what to finish first when a locked step is pressed', async () => {
    renderAt('setup/clinic-type');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('setup-drawer-step-you-trigger'));
    expect(notify.info).toHaveBeenCalledWith('Finish “Where is your clinic?” first');
  });

  it('moves a locked step’s address to the first open step', async () => {
    const { router } = renderAt('setup/you');
    await waitFor(() => expect(router.state.location.hash).toBe('setup/clinic-type'));
  });

  it('counts step 3 of 3 on the last step, which goes live', async () => {
    state.setup = setupOf({
      answeredSteps: ['clinic_type'],
      liveChecks: { clinic_type: true, main_branch: true, services: false },
      mainBranchId: 'brn_mainaaaaaaaaaaaaaaaaa',
      nextStep: 'you',
    });
    const { router } = renderAt('setup');

    await waitFor(() => expect(router.state.location.hash).toBe('setup/you'));
    expect(await screen.findByText('About a minute · Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('setup-drawer-save')).toHaveTextContent('Go live');
    expect(screen.getByTestId('setup-drawer-step-clinic-type')).toHaveAttribute(
      'data-status',
      'done',
    );
  });

  it('step 1 needs a specialty, then saves the specialties and the answered step', async () => {
    state.profile = { ...PROFILE, specialties: [] };
    renderAt('setup/clinic-type');
    const user = userEvent.setup();

    await user.click(await screen.findByTestId('setup-drawer-save'));
    expect(await screen.findByText('Pick at least one specialty.')).toBeInTheDocument();
    expect(state.updateProfileMutateAsync).not.toHaveBeenCalled();
    expect(state.changeMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('setup-specialty-skin'));
    await user.click(screen.getByTestId('setup-drawer-save'));

    await waitFor(() =>
      expect(state.changeMutateAsync).toHaveBeenCalledWith({
        answeredStepsAdd: ['clinic_type'],
      }),
    );
    expect(state.updateProfileMutateAsync).toHaveBeenCalledWith({
      specialties: ['skin'],
    });
    expect(state.updateProfileMutateAsync.mock.invocationCallOrder[0]).toBeLessThan(
      state.changeMutateAsync.mock.invocationCallOrder[0] ?? 0,
    );
    expect(setupEvents.stepCompleted).toHaveBeenCalledWith('clinic_type');
  });

  it('step 1 saves only the answer when the specialties did not change', async () => {
    renderAt('setup/clinic-type');
    const user = userEvent.setup();

    await user.click(await screen.findByTestId('setup-drawer-save'));

    await waitFor(() =>
      expect(state.changeMutateAsync).toHaveBeenCalledWith({
        answeredStepsAdd: ['clinic_type'],
      }),
    );
    expect(state.updateProfileMutateAsync).not.toHaveBeenCalled();
  });

  it('closing a setup not live and not deferred is “Explore first” — deferred on the server', async () => {
    const { router } = renderAt('setup/clinic-type');
    const user = userEvent.setup();

    await user.click(await screen.findByTestId('setup-drawer-dismiss'));

    expect(state.changeMutate).toHaveBeenCalledWith({ deferred: true });
    expect(setupEvents.deferred).toHaveBeenCalledWith('clinic_type');
    await waitFor(() => expect(router.state.location.hash).toBe(''));
  });

  it('closing a setup already deferred sends nothing', async () => {
    state.setup = setupOf({ deferredAt: '2026-10-13T04:40:00Z' });
    const { router } = renderAt('setup/clinic-type');
    const user = userEvent.setup();

    await user.click(await screen.findByTestId('setup-drawer-dismiss'));

    await waitFor(() => expect(router.state.location.hash).toBe(''));
    expect(state.changeMutate).not.toHaveBeenCalled();
  });
});

describe('SetupDrawer — once live', () => {
  it('shows “You’re live” at #setup/live', async () => {
    state.setup = setupOf(LIVE);
    renderAt('setup/live');

    expect(await screen.findByTestId('setup-live-title')).toHaveTextContent(
      "You're live",
    );
    expect(
      screen.getByText('Acme Skin Clinic can book and bill now.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('setup-live-book')).toHaveTextContent(
      'Book your first appointment',
    );
  });

  it('closes “You’re live” without deferring anything', async () => {
    state.setup = setupOf(LIVE);
    const { router } = renderAt('setup/live');
    const user = userEvent.setup();

    await user.click(await screen.findByTestId('setup-live-done'));

    await waitFor(() => expect(router.state.location.hash).toBe(''));
    expect(state.changeMutate).not.toHaveBeenCalled();
  });

  it('shows the guide’s three items at #setup/guide, Skip only where it may be skipped', async () => {
    state.setup = setupOf(LIVE);
    renderAt('setup/guide');

    const guide = await screen.findByTestId('setup-guide');
    expect(within(guide).getByTestId('setup-guide-title')).toHaveTextContent(
      'Finish setting up Acme Skin Clinic',
    );
    for (const key of ['treatments', 'invite_team', 'first_appointment']) {
      expect(within(guide).getByTestId(`setup-guide-item-${key}`)).toBeInTheDocument();
    }
    expect(
      within(guide).getByTestId('setup-guide-item-treatments-skip'),
    ).toBeInTheDocument();
    expect(
      within(guide).getByTestId('setup-guide-item-invite_team-skip'),
    ).toBeInTheDocument();
    expect(
      within(guide).queryByTestId('setup-guide-item-first_appointment-skip'),
    ).not.toBeInTheDocument();
    expect(await axeForDialog(guide)).toHaveNoViolations();
  });

  it('sends a live clinic’s step address to the guide', async () => {
    state.setup = setupOf(LIVE);
    const { router } = renderAt('setup/clinic-type');
    await waitFor(() => expect(router.state.location.hash).toBe('setup/guide'));
  });
});
