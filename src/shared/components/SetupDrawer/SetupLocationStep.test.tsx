import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  fetchBranches: vi.fn(),
  fetchOnboardingSetup: vi.fn(),
  lookupPin: vi.fn(),
}));
vi.mock('@/shared/api/app/branches-manage-api.ts', () => ({
  saveBranch: api.saveBranch,
  fetchBranches: api.fetchBranches,
}));
vi.mock('@/shared/api/app/onboarding-setup-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OnboardingSetupApiModule>()),
  fetchOnboardingSetup: api.fetchOnboardingSetup,
}));
vi.mock('@/shared/app/pin-directory/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PinDirectoryModule>()),
  lookupPin: api.lookupPin,
}));
vi.mock('./setup-analytics.ts', () => ({
  setupEvents: { stepCompleted: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { setupEvents } from './setup-analytics.ts';
import {
  initialLocationForm,
  locationFormFromBranch,
  type LocationFormValues,
} from './setup-location-form.ts';
import type { LocationQuestion } from './setup-place.ts';
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

/**
 * The step as the drawer holds it: the answers in one form above the questions, the open question
 * in state, the step remounted for each question (the drawer keys its body by question).
 */
function Harness({
  start,
  values,
}: {
  start: LocationQuestion;
  values?: LocationFormValues;
}) {
  const form = useForm<LocationFormValues>({
    defaultValues:
      values ??
      initialLocationForm({ clinicName: PROFILE.name, email: 'owner@acme.test' }),
  });
  const [question, setQuestion] = useState<LocationQuestion>(start);
  return (
    <>
      <h3 id="setup-question-title">{question}</h3>
      <p data-testid="open-question">{question}</p>
      <SetupLocationStep
        key={question}
        formId="setup-form-location"
        titleId="setup-question-title"
        setup={setupOf()}
        profile={PROFILE}
        form={form}
        question={question}
        onQuestionChange={setQuestion}
        {...props}
      />
      <button type="submit" form="setup-form-location">
        Next
      </button>
    </>
  );
}

async function renderStep(start: LocationQuestion = 'pin', values?: LocationFormValues) {
  const rendered = renderWithProviders(<Harness start={start} values={values} />);
  // The router mounts the tree after its first load.
  await screen.findByTestId('open-question');
  return rendered;
}

/** Answers the PIN and the street address, ending on the phone. */
async function answerToThePhone(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByTestId('setup-question-pin-input'), '395007');
  await user.click(await screen.findByRole('button', { name: 'Vesu' }));
  await user.type(screen.getByTestId('setup-question-address-input'), '12 Ring Road');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  return screen.findByTestId('setup-question-phone-input');
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

describe('SetupLocationStep — the PIN', () => {
  it('asks one thing, labelled by the question, with nothing else to fill', async () => {
    const { container } = await renderStep();
    const pin = await screen.findByTestId('setup-question-pin-input');
    expect(pin).toHaveAccessibleName('pin');
    expect(screen.queryByTestId('setup-question-address-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('setup-question-phone-input')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves on by itself at the sixth digit, with the place the PIN names', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.type(await screen.findByTestId('setup-question-pin-input'), '39x5007');

    expect(api.lookupPin).toHaveBeenCalledWith('395007');
    await waitFor(() =>
      expect(screen.getByTestId('open-question')).toHaveTextContent('address'),
    );
    expect(await screen.findByTestId('setup-question-address-place')).toHaveTextContent(
      'Surat · Gujarat',
    );
    // A PIN with several areas offers them; the one picked joins the place.
    await user.click(screen.getByRole('button', { name: 'Adajan' }));
    expect(screen.getByTestId('setup-question-address-place')).toHaveTextContent(
      'Adajan · Surat · Gujarat',
    );
  });

  it('moves on for a PIN it does not know, with the place to type', async () => {
    api.lookupPin.mockResolvedValue(null);
    await renderStep();
    const user = userEvent.setup();

    await user.type(await screen.findByTestId('setup-question-pin-input'), '999999');

    expect(await screen.findByTestId('setup-location-pin-unknown')).toBeInTheDocument();
    expect(screen.getByTestId('setup-location-city')).toHaveValue('');
    expect(screen.queryByTestId('setup-question-address-place')).not.toBeInTheDocument();
  });

  it('stays on a PIN that cannot be one, and on Next without one', async () => {
    await renderStep();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    const pin = screen.getByTestId('setup-question-pin-input');
    expect(pin).toHaveAttribute('aria-invalid', 'true');
    expect(pin).toHaveFocus();

    await user.type(pin, '012345');
    expect(await screen.findByText('Enter the six-digit PIN code.')).toBeInTheDocument();
    expect(screen.getByTestId('open-question')).toHaveTextContent('pin');
    expect(api.saveBranch).not.toHaveBeenCalled();
    expect(props.onSaveState).not.toHaveBeenCalled();
  });
});

describe('SetupLocationStep — the street address', () => {
  it('names a missing address and a missing area, and opens the place to fix it', async () => {
    await renderStep();
    const user = userEvent.setup();
    await user.type(await screen.findByTestId('setup-question-pin-input'), '395007');
    await screen.findByTestId('setup-question-address-place');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByTestId('setup-question-address-input')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // Surat has two areas and none is picked: the fields open with the area to give.
    expect(screen.getByTestId('setup-location-area')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByTestId('open-question')).toHaveTextContent('address');
  });

  it('opens area, city and state on Edit', async () => {
    await renderStep();
    const user = userEvent.setup();
    await user.type(await screen.findByTestId('setup-question-pin-input'), '395007');

    await user.click(await screen.findByTestId('setup-question-address-edit'));

    expect(screen.getByTestId('setup-location-city')).toHaveValue('Surat');
    expect(screen.getByTestId('setup-location-state')).toHaveValue('Gujarat');
  });
});

describe('SetupLocationStep — the phone', () => {
  it('creates the main branch named after the clinic, naming no team, then moves on', async () => {
    const { container } = await renderStep();
    const user = userEvent.setup();
    const phone = await answerToThePhone(user);
    expect(await axe(container)).toHaveNoViolations();

    await user.type(phone, '9876543210');
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
          email: 'owner@acme.test',
          workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          opensAt: '10:00',
          closesAt: '20:00',
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

  it('names a phone that is not one and saves nothing', async () => {
    await renderStep();
    const user = userEvent.setup();
    const phone = await answerToThePhone(user);

    await user.type(phone, '12345');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(api.saveBranch).not.toHaveBeenCalled();
  });

  it('creates no second branch when a main branch was made meanwhile', async () => {
    api.fetchOnboardingSetup.mockReset().mockResolvedValue(WITH_MAIN_BRANCH);
    const main = appBranch({ id: 'brn_mainaaaaaaaaaaaaaaaaa', isMain: true });
    await renderStep('phone', locationFormFromBranch(main));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.saveBranch).not.toHaveBeenCalled();
  });

  it('saves a change typed over a main branch already made to that branch', async () => {
    api.fetchOnboardingSetup.mockReset().mockResolvedValue(WITH_MAIN_BRANCH);
    const main = appBranch({ id: 'brn_mainaaaaaaaaaaaaaaaaa', isMain: true });
    api.fetchBranches.mockResolvedValue([main]);
    await renderStep('phone', locationFormFromBranch(main));
    const user = userEvent.setup();
    const phone = await screen.findByTestId('setup-question-phone-input');

    await user.clear(phone);
    await user.type(phone, '9123456780');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
    expect(api.saveBranch).toHaveBeenCalledWith({
      save: {
        branch: main,
        input: expect.objectContaining({
          name: 'Vesu',
          phone: '+919123456780',
          email: 'vesu@clinic.com',
          closesAt: '19:00',
        }),
      },
      idempotencyKey: expect.any(String),
    });
  });

  it('goes back to a question a refresh left empty instead of saving', async () => {
    await renderStep('phone');
    const user = userEvent.setup();
    await user.type(
      await screen.findByTestId('setup-question-phone-input'),
      '9876543210',
    );

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() =>
      expect(screen.getByTestId('open-question')).toHaveTextContent('pin'),
    );
    expect(api.saveBranch).not.toHaveBeenCalled();
  });

  it('stays on the question when the create is refused', async () => {
    api.saveBranch.mockRejectedValue(new Error('refused'));
    await renderStep();
    const user = userEvent.setup();
    const phone = await answerToThePhone(user);
    await user.type(phone, '9876543210');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(props.onSaveState).toHaveBeenLastCalledWith('failed'));
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(screen.getByTestId('open-question')).toHaveTextContent('phone');
  });
});
