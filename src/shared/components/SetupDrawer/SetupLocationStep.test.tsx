import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import type * as OnboardingSetupApiModule from '@/shared/api/app/onboarding-setup-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import type * as PinDirectoryModule from '@/shared/app/pin-directory/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { appBranch } from '@/tests/utils/branch-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const api = vi.hoisted(() => ({
  saveBranch: vi.fn(),
  fetchOnboardingSetup: vi.fn(),
  lookupPin: vi.fn(),
}));
vi.mock('@/shared/api/app/branches-manage-api.ts', () => ({
  saveBranch: api.saveBranch,
}));
vi.mock('@/shared/api/app/onboarding-setup-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OnboardingSetupApiModule>()),
  fetchOnboardingSetup: api.fetchOnboardingSetup,
}));
vi.mock('@/shared/app/pin-directory/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PinDirectoryModule>()),
  lookupPin: api.lookupPin,
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
vi.mock('./setup-analytics.ts', () => ({
  setupEvents: { stepCompleted: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { setupEvents } from './setup-analytics.ts';
import { SetupLocationStep } from './SetupLocationStep.tsx';

const PROFILE: ClinicProfile = {
  name: 'Acme Skin Clinic',
  specialties: ['skin'],
  timezone: 'Asia/Kolkata',
  createdAt: '2026-10-01T04:30:00Z',
  updatedAt: '2026-10-13T04:30:00Z',
};

/** A clinic's setup with step 1 answered, unless the overrides say otherwise. */
function setupOf(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return {
    answeredSteps: ['clinic_type'],
    skippedItems: [],
    mainBranchId: null,
    nextStep: 'location',
    liveChecks: { clinic_type: true, main_branch: false, services: false },
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

const WITH_MAIN_BRANCH = setupOf({
  mainBranchId: 'brn_mainaaaaaaaaaaaaaaaaa',
  nextStep: 'you',
  liveChecks: { clinic_type: true, main_branch: true, services: false },
});

const SURAT = { district: 'Surat', state: 'Gujarat', areas: ['Vesu', 'Adajan'] };

const props = {
  onDirtyChange: vi.fn(),
  onSaveState: vi.fn(),
  onSaved: vi.fn(),
};

async function renderStep() {
  const rendered = renderWithProviders(
    <>
      <SetupLocationStep
        formId="setup-form-location"
        setup={setupOf()}
        profile={PROFILE}
        {...props}
      />
      <button type="submit" form="setup-form-location">
        Next
      </button>
    </>,
  );
  // The router mounts the tree after its first load.
  await screen.findByTestId('setup-location-pin');
  return rendered;
}

/** Fills every field the step needs, the PIN first. */
async function fillTheStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('setup-location-pin'), '395007');
  await waitFor(() =>
    expect(screen.getByTestId('setup-location-city')).toHaveValue('Surat'),
  );
  await user.click(screen.getByRole('button', { name: 'Vesu' }));
  await user.type(screen.getByTestId('setup-location-addressLine'), '12 Ring Road');
  await user.type(screen.getByTestId('setup-location-phone'), '9876543210');
  await user.type(screen.getByTestId('setup-location-email'), 'front@acme.test');
}

beforeEach(() => {
  vi.resetAllMocks();
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  api.lookupPin.mockResolvedValue(SURAT);
  api.saveBranch.mockResolvedValue(appBranch({ isMain: true }));
  api.fetchOnboardingSetup
    .mockResolvedValueOnce(setupOf())
    .mockResolvedValue(WITH_MAIN_BRANCH);
});

describe('SetupLocationStep — "Where is your clinic?"', () => {
  it('starts with the clinic’s name as the branch name and the house hours', async () => {
    const { container } = await renderStep();
    expect(screen.getByTestId('setup-location-name')).toHaveValue('Acme Skin Clinic');
    expect(screen.getByTestId('setup-location-hours')).toHaveTextContent(
      'mon, tue, wed, thu, fri, sat',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('fills the city and state from the PIN and offers its areas', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('setup-location-pin'), '39x5007');

    expect(api.lookupPin).toHaveBeenCalledWith('395007');
    await waitFor(() =>
      expect(screen.getByTestId('setup-location-city')).toHaveValue('Surat'),
    );
    expect(screen.getByTestId('setup-location-pin')).toHaveValue('395007');
    expect(screen.getByTestId('setup-location-state')).toHaveValue('Gujarat');
    await user.click(screen.getByRole('button', { name: 'Adajan' }));
    expect(screen.getByTestId('setup-location-area')).toHaveValue('Adajan');
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('fills nothing for a PIN it does not know, and blocks nothing', async () => {
    api.lookupPin.mockResolvedValue(null);
    await renderStep();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('setup-location-pin'), '999999');

    expect(await screen.findByTestId('setup-location-pin-unknown')).toBeInTheDocument();
    expect(screen.getByTestId('setup-location-city')).toHaveValue('');
  });

  it('names what is missing and saves nothing', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByTestId('setup-location-pin')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByTestId('setup-location-addressLine')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByTestId('setup-location-pin')).toHaveFocus();
    expect(api.saveBranch).not.toHaveBeenCalled();
    expect(props.onSaveState).not.toHaveBeenCalled();
  });

  it('creates the main branch naming no team, reads the setup again, then moves on', async () => {
    await renderStep();
    const user = userEvent.setup();
    await fillTheStep(user);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.saveBranch).toHaveBeenCalledWith({
      save: {
        input: expect.objectContaining({
          name: 'Acme Skin Clinic',
          addressLine1: '12 Ring Road',
          area: 'Vesu',
          city: 'Surat',
          state: 'Gujarat',
          pin: '395007',
          phone: '+919876543210',
          email: 'front@acme.test',
          workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        }),
      },
      idempotencyKey: expect.any(String),
    });
    // The creator joins the branch on the server (D13): no membership id from a stale me/context.
    const [call] = api.saveBranch.mock.calls[0] as [{ save: object }];
    expect(call.save).not.toHaveProperty('memberIds');
    // Read again after the create, so the drawer finds step 3 open when it moves on.
    expect(api.fetchOnboardingSetup).toHaveBeenCalledTimes(2);
    expect(api.saveBranch.mock.invocationCallOrder[0]).toBeLessThan(
      api.fetchOnboardingSetup.mock.invocationCallOrder[1] ?? 0,
    );
    expect(props.onSaveState).toHaveBeenNthCalledWith(1, 'saving');
    expect(props.onSaveState).toHaveBeenLastCalledWith('idle');
    expect(setupEvents.stepCompleted).toHaveBeenCalledWith('location');
  });

  it('creates no second branch when a main branch was made meanwhile', async () => {
    api.fetchOnboardingSetup.mockReset().mockResolvedValue(WITH_MAIN_BRANCH);
    await renderStep();
    const user = userEvent.setup();
    await fillTheStep(user);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.saveBranch).not.toHaveBeenCalled();
  });

  it('stays on the step when the create is refused', async () => {
    api.saveBranch.mockRejectedValue(new Error('refused'));
    await renderStep();
    const user = userEvent.setup();
    await fillTheStep(user);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(props.onSaveState).toHaveBeenLastCalledWith('failed'));
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('opens and folds the days and times with Change', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('setup-location-hours-change'));
    expect(screen.getByTestId('setup-location-hours-change')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByTestId('setup-location-hours-change'));
    expect(screen.getByTestId('setup-location-hours-change')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
