import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import type * as OnboardingSetupApiModule from '@/shared/api/app/onboarding-setup-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import type * as ErrorHandlerModule from '@/shared/errors/errorHandler.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type * as MeContextModule from '@/shared/tenancy/me-context.ts';
import { appBranch } from '@/tests/utils/branch-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const api = vi.hoisted(() => ({
  updateMember: vi.fn(),
  fetchBranches: vi.fn(),
  saveBranch: vi.fn(),
  fetchOnboardingSetup: vi.fn(),
  fetchMeContext: vi.fn(),
  changeMutateAsync: vi.fn(),
  runGoLive: vi.fn(),
  reportError: vi.fn(),
  openBranches: [] as BranchOption[],
}));
vi.mock('@/shared/api/organization-api.ts', () => ({ updateMember: api.updateMember }));
vi.mock('@/shared/api/app/branches-manage-api.ts', () => ({
  fetchBranches: api.fetchBranches,
  saveBranch: api.saveBranch,
}));
vi.mock('@/shared/api/app/onboarding-setup-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OnboardingSetupApiModule>()),
  fetchOnboardingSetup: api.fetchOnboardingSetup,
}));
vi.mock('@/shared/tenancy/me-context.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MeContextModule>()),
  fetchMeContext: api.fetchMeContext,
}));
vi.mock('@/shared/hooks/useOnboardingSetup/index.ts', () => ({
  useChangeOnboardingSetup: () => ({
    mutateAsync: api.changeMutateAsync,
    isPending: false,
  }),
}));
vi.mock('@/shared/hooks/useAppRoles/index.ts', () => ({
  useAppRoles: () => ({
    roles: [
      { id: 'rol_owner', isSystem: true, preset: 'owner' },
      { id: 'rol_doctor', isSystem: true, preset: 'doctor' },
      { id: 'rol_therapist', isSystem: true, preset: 'therapist' },
    ],
  }),
}));
vi.mock('@/shared/hooks/useBranches/index.ts', () => ({
  useBranches: () => ({ openBranches: api.openBranches }),
}));
vi.mock('@/shared/hooks/useCan/index.ts', () => ({ useCan: () => true }));
vi.mock('@/shared/errors/errorHandler.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ErrorHandlerModule>()),
  reportError: api.reportError,
}));
vi.mock('./go-live.ts', () => ({ runGoLive: api.runGoLive }));
vi.mock('./use-consultation-name.ts', () => ({
  useConsultationName: () => () => 'Consultation',
}));
vi.mock('./setup-analytics.ts', () => ({
  setupEvents: { stepCompleted: vi.fn(), live: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { setupEvents } from './setup-analytics.ts';
import { SetupYouStep } from './SetupYouStep.tsx';

const PROFILE: ClinicProfile = {
  name: 'Acme Skin Clinic',
  specialties: ['skin'],
  timezone: 'Asia/Kolkata',
  createdAt: '2026-10-01T04:30:00Z',
  updatedAt: '2026-10-13T04:30:00Z',
};

const OWNER = 'mem_owneraaaaaaaaaaaaaaaa';
const MAIN = appBranch({
  isMain: true,
  workingDays: ['mon', 'tue', 'wed'],
  opensAt: '09:00',
  closesAt: '18:00',
});

/** A clinic's setup on step 3, unless the overrides say otherwise. */
function setupOf(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return {
    answeredSteps: ['clinic_type'],
    skippedItems: [],
    mainBranchId: MAIN.id,
    nextStep: 'you',
    liveChecks: { clinic_type: true, main_branch: true, services: false },
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

const LIVE = setupOf({
  answeredSteps: ['clinic_type', 'you'],
  liveChecks: { clinic_type: true, main_branch: true, services: true },
  nextStep: null,
  isLive: true,
  completedAt: '2026-10-13T05:00:00Z',
  completedByMembershipId: OWNER,
});

const props = {
  onDirtyChange: vi.fn(),
  onSaveState: vi.fn(),
  onSaved: vi.fn(),
};

async function renderStep(setup: OnboardingSetup = setupOf()) {
  const rendered = renderWithProviders(
    <>
      <h3 id="setup-question-title">Do you see patients yourself?</h3>
      <SetupYouStep
        formId="setup-form-you"
        titleId="setup-question-title"
        setup={setup}
        profile={PROFILE}
        {...props}
      />
      <button type="submit" form="setup-form-you">
        Go live
      </button>
    </>,
  );
  // The router mounts the tree after its first load.
  await screen.findByTestId('setup-you-doctor');
  return rendered;
}

beforeEach(() => {
  vi.resetAllMocks();
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  api.openBranches = [
    {
      id: MAIN.id,
      name: MAIN.name,
      tone: MAIN.tone,
      isMain: true,
      opensAt: MAIN.opensAt,
      closesAt: MAIN.closesAt,
      workingDays: MAIN.workingDays,
    },
  ];
  // The membership this workspace names — never one cached from the personal workspace.
  api.fetchMeContext.mockResolvedValue({
    membershipId: OWNER,
    myRoles: [{ id: 'rol_owner', name: 'Owner', tone: 'stone', isSystem: true }],
  });
  api.updateMember.mockResolvedValue(undefined);
  api.fetchBranches.mockResolvedValue([MAIN]);
  api.saveBranch.mockResolvedValue(MAIN);
  api.changeMutateAsync.mockResolvedValue(
    setupOf({ answeredSteps: ['clinic_type', 'you'] }),
  );
  api.runGoLive.mockResolvedValue({ setup: LIVE, created: [], consultations: [] });
});

describe('SetupYouStep — "Do you see patients yourself?"', () => {
  it('asks for an answer before going live', async () => {
    const { container } = await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Go live' }));

    expect(api.runGoLive).not.toHaveBeenCalled();
    expect(props.onSaveState).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a tap on “Yes, as a doctor” adds Doctor to the owner with the main branch’s hours, makes them its default doctor, and goes live', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-you-doctor'));
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true);

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.updateMember).toHaveBeenCalledWith({
      membershipId: OWNER,
      change: {
        roleIds: ['rol_owner', 'rol_doctor'],
        workingDays: ['mon', 'tue', 'wed'],
        workStartsAt: '09:00',
        workEndsAt: '18:00',
      },
      idempotencyKey: expect.stringMatching(/-role$/),
    });
    expect(api.saveBranch).toHaveBeenCalledWith({
      save: {
        branch: MAIN,
        input: expect.objectContaining({ defaultDoctorId: OWNER, name: MAIN.name }),
      },
      idempotencyKey: expect.stringMatching(/-branch-default$/),
    });
    // The branch's team is left as it is.
    const [call] = api.saveBranch.mock.calls[0] as [{ save: object }];
    expect(call.save).not.toHaveProperty('memberIds');
    expect(api.changeMutateAsync).toHaveBeenCalledWith({ answeredStepsAdd: ['you'] });
    expect(api.runGoLive).toHaveBeenCalledWith(
      expect.objectContaining({ specialties: ['skin'], canSetLowestPrice: true }),
    );
    expect(setupEvents.stepCompleted).toHaveBeenCalledWith('you');
    expect(setupEvents.live).toHaveBeenCalledTimes(1);
    expect(props.onSaveState).toHaveBeenLastCalledWith('idle');
  });

  it('a tap on “Yes, as a therapist” makes the owner the branch’s default therapist', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-you-therapist'));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.updateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        change: expect.objectContaining({ roleIds: ['rol_owner', 'rol_therapist'] }),
      }),
    );
    expect(api.saveBranch).toHaveBeenCalledWith(
      expect.objectContaining({
        save: expect.objectContaining({
          input: expect.objectContaining({
            defaultTherapistId: OWNER,
            defaultDoctorId: null,
          }),
        }),
      }),
    );
  });

  it('a tap on “No” goes live without touching the owner or the branch', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-you-no'));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.updateMember).not.toHaveBeenCalled();
    expect(api.saveBranch).not.toHaveBeenCalled();
    expect(api.runGoLive).toHaveBeenCalledTimes(1);
  });

  it('goes live although the branch default is refused', async () => {
    api.saveBranch.mockRejectedValue(new Error('not on the team'));
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-you-doctor'));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.reportError).toHaveBeenCalledWith(expect.any(Error), {
      scope: 'setup-branch-default',
    });
  });

  it('goes live again without a new answer once the step was answered', async () => {
    await renderStep(setupOf({ answeredSteps: ['clinic_type', 'you'] }));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Go live' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.changeMutateAsync).not.toHaveBeenCalled();
    expect(api.updateMember).not.toHaveBeenCalled();
  });

  it('names what is missing when the server refuses to go live', async () => {
    api.runGoLive.mockRejectedValue(
      new HttpError('Conflict', 409, '/app/onboarding-setup/complete', 'POST', {
        error: { reason: 'onboarding_setup_incomplete' },
      }),
    );
    api.fetchOnboardingSetup.mockResolvedValue(
      setupOf({ liveChecks: { clinic_type: true, main_branch: false, services: false } }),
    );
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-you-no'));

    await waitFor(() => expect(notify.error).toHaveBeenCalledTimes(1));
    expect(api.fetchOnboardingSetup).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notify.error).mock.calls[0]?.[0]).toBe(
      "Can't go live yet — still missing: where it is, a service.",
    );
    expect(props.onSaveState).toHaveBeenLastCalledWith('failed');
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('goes live once for a second tap while the first is going live', async () => {
    const going: { finish?: (value: unknown) => void } = {};
    api.runGoLive.mockReturnValue(
      new Promise((resolve) => {
        going.finish = resolve;
      }),
    );
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-you-doctor'));
    await user.click(screen.getByRole('button', { name: 'Go live' }));
    going.finish?.({ setup: LIVE, created: [], consultations: [] });

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.runGoLive).toHaveBeenCalledTimes(1);
  });

  it('says the save failed on any other refusal', async () => {
    api.runGoLive.mockRejectedValue(new Error('offline'));
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-you-no'));

    await waitFor(() => expect(notify.error).toHaveBeenCalledTimes(1));
    expect(api.fetchOnboardingSetup).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });
});
