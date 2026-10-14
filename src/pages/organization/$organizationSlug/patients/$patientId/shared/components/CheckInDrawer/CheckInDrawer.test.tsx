import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import type * as FeedbackApiModule from '@/shared/api/app/feedback-api.ts';
import {
  createCheckIn,
  fetchCheckIn,
  updateCheckIn,
} from '@/shared/api/app/feedback-api.ts';
import type { PatientCheckIn } from '@/shared/api/app/feedback-contracts.ts';
import type * as OfferingsApiModule from '@/shared/api/app/offerings-api.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import type * as TreatmentsApiModule from '@/shared/api/app/treatments-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { CheckInDrawer, type CheckInDrawerProps } from './CheckInDrawer.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const D = 'check-in-drawer';
const TODAY = '2026-10-10';
const LHR = 'trt_lhr000000000000000000';
const VISIT = 'appt_visit00000000000000';
const HYDRAFACIAL = 'off_hydra0000000000000000';

/** A check-in as the file reads it — the visit before, Better at 7. */
function checkIn(overrides: Partial<PatientCheckIn> = {}): PatientCheckIn {
  return {
    id: 'chk_before000000000000000',
    patientId: TEST_PATIENT_ID,
    appointmentId: null,
    treatmentId: null,
    context: 'Visit · 24 Sep',
    feel: 'better',
    score: 7,
    scoreChange: null,
    followed: 'mostly',
    followedNote: null,
    currentState: 'Mild redness settled, skin feels smoother',
    nextPlan: 'Sunscreen every day',
    nextOfferingIds: [],
    date: '2026-09-24',
    needsAction: false,
    actions: [],
    createdAt: '2026-09-24T05:00:00.000Z',
    updatedAt: '2026-09-24T05:00:00.000Z',
    ...overrides,
  };
}

/** An offering of the one catalogue (`fetchAllOfferings`) the drawer picks from. */
const offering = (overrides: Partial<OfferingRecord>): OfferingRecord =>
  offeringRecord({
    id: HYDRAFACIAL,
    name: 'Hydrafacial',
    category: 'treatment',
    tone: 'sky',
    price: 3500,
    sessions: 1,
    searchTerms: [],
    isActive: true,
    ...overrides,
  });

vi.mock('@/shared/api/app/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof FeedbackApiModule>()),
  fetchPreviousCheckIn: vi.fn(),
  fetchCheckIn: vi.fn(),
  createCheckIn: vi.fn(),
  updateCheckIn: vi.fn(),
}));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchAllOfferings: vi.fn(),
}));
vi.mock('@/shared/api/app/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TreatmentsApiModule>()),
  fetchTreatment: vi.fn(async () => ({ id: LHR, name: 'LHR Full Face' })),
}));
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppointmentsApiModule>()),
  fetchAppointment: vi.fn(async () =>
    appointmentRow({ id: VISIT, serviceLabel: 'Peel' }),
  ),
}));

async function open(props: Partial<CheckInDrawerProps> = {}) {
  const onClose = vi.fn();
  const user = userEvent.setup();
  const view = renderInPatientFile(
    <CheckInDrawer
      patientId={TEST_PATIENT_ID}
      patientName="Priya Shah"
      checkIn={null}
      appointmentId={null}
      treatmentId={null}
      today={TODAY}
      onClose={onClose}
      {...props}
    />,
    { file: patientFile(), section: 'overview' },
  );
  const drawer = await screen.findByTestId(D);
  return { ...view, user, drawer, onClose };
}

beforeEach(async () => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  const api = await import('@/shared/api/app/feedback-api.ts');
  vi.mocked(api.fetchPreviousCheckIn).mockResolvedValue(checkIn());
  const catalogue = await import('@/shared/api/app/offerings-api.ts');
  vi.mocked(catalogue.fetchAllOfferings).mockResolvedValue([
    offering({}),
    offering({ id: 'off_old', name: 'Old peel', isActive: false }),
  ]);
});
afterEach(() => {
  resetPatientFile();
  vi.resetAllMocks();
});

describe('Visit / Aftercare check-in (KICKOFF §6.6; S:44–45)', () => {
  it('opens a visit check-in with its three steps, headed by the last check-in', async () => {
    const { drawer, baseElement } = await open();
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Visit check-in');
    await waitFor(() => expect(drawer).toHaveTextContent(/last check-in .+: Better/));
    expect(drawer).toHaveTextContent('Priya Shah');
    for (const step of ['How is it now', 'What they followed', 'Next plan of action']) {
      expect(drawer).toHaveTextContent(step);
    }
    expect(within(drawer).getByTestId(`${D}-now`)).toHaveAttribute(
      'placeholder',
      'Last time: Mild redness settled, skin feels smoother',
    );
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save check-in');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('writes last time’s plan into Details and Next plan in one tap (feat-write-less)', async () => {
    const { user, drawer } = await open();
    await user.click(within(drawer).getByTestId(`${D}-step-followed-trigger`));
    await user.click(
      await within(drawer).findByTestId(`${D}-details-suggestion-advised`),
    );
    expect(within(drawer).getByTestId(`${D}-details`)).toHaveValue('Sunscreen every day');
    expect(within(drawer).queryByTestId(`${D}-details-suggestion-advised`)).toBeNull();

    await user.click(within(drawer).getByTestId(`${D}-step-next-trigger`));
    const same = await within(drawer).findByTestId(`${D}-plan-suggestion-same`);
    expect(same).toHaveTextContent('Same plan as last time');
    await user.click(same);
    expect(within(drawer).getByTestId(`${D}-plan`)).toHaveValue('Sunscreen every day');
  });

  it('is an aftercare check-in named after the session it follows', async () => {
    const { drawer } = await open({ treatmentId: LHR });
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Aftercare check-in',
    );
    await waitFor(() => expect(drawer).toHaveTextContent('LHR Full Face'));
  });

  it('names the visit’s service when a booking opened it', async () => {
    const { drawer } = await open({ appointmentId: VISIT });
    await waitFor(() => expect(drawer).toHaveTextContent('Peel'));
  });

  it('asks how it is now, then the score (Q18), before it saves', async () => {
    const { user, drawer } = await open();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick how it is now');
    await user.click(within(drawer).getByTestId(`${D}-feel-same`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledTimes(2);
    expect(notifyMock.warning).not.toHaveBeenLastCalledWith('Pick how it is now');
    expect(createCheckIn).not.toHaveBeenCalled();
  });

  it('saves a bad check-in with an offering — the toast reads what the server did', async () => {
    vi.mocked(createCheckIn).mockResolvedValue(
      checkIn({
        id: 'chk_new',
        feel: 'worse',
        score: 3,
        nextOfferingIds: [HYDRAFACIAL],
        needsAction: true,
      }),
    );
    const { user, drawer, onClose } = await open({ appointmentId: VISIT });
    await user.click(within(drawer).getByTestId(`${D}-feel-worse`));
    await user.click(within(drawer).getByTestId(`${D}-score-3`));
    await user.type(within(drawer).getByTestId(`${D}-now`), 'Itching again');
    await user.click(within(drawer).getByTestId(`${D}-step-followed-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-followed-partly`));
    await user.click(within(drawer).getByTestId(`${D}-step-next-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-plan`), 'Review in a week');
    await user.click(within(drawer).getByTestId(`${D}-offerings`));
    // Only the active offerings are offered.
    expect(screen.queryByTestId(`${D}-offerings-option-off_old`)).not.toBeInTheDocument();
    await user.click(await screen.findByTestId(`${D}-offerings-option-${HYDRAFACIAL}`));
    await user.keyboard('{Escape}');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Check-in saved for Priya Shah · 1 added to suggestions · doctor call-back task created',
      ),
    );
    expect(createCheckIn).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      input: {
        feel: 'worse',
        score: 3,
        currentState: 'Itching again',
        followed: 'partly',
        followedNote: null,
        nextPlan: 'Review in a week',
        appointmentId: VISIT,
        treatmentId: null,
        date: TODAY,
        nextOfferingIds: [HYDRAFACIAL],
      },
      idempotencyKey: expect.any(String),
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('puts the server’s field error on the field and opens its step', async () => {
    vi.mocked(createCheckIn).mockRejectedValue(
      new HttpError('Bad request', 400, '/app/patients/x/check-ins', 'POST', {
        error: {
          type: 'validation_error',
          errors: [{ field: 'body.next_plan', message: 'Too long' }],
        },
      }),
    );
    const { user, drawer } = await open();
    await user.click(within(drawer).getByTestId(`${D}-feel-better`));
    await user.click(within(drawer).getByTestId(`${D}-score-8`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith('Too long'));
    expect(within(drawer).getByTestId(`${D}-step-next`)).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(within(drawer).getByTestId(`${D}-plan`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('opens a saved one prefilled — its offerings named, not picked — and saves the changes', async () => {
    const saved = checkIn({ id: 'chk_saved', nextOfferingIds: [HYDRAFACIAL] });
    vi.mocked(updateCheckIn).mockResolvedValue(saved);
    const { user, drawer } = await open({ checkIn: saved });
    expect(within(drawer).getByTestId(`${D}-feel-better`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save changes');
    await user.click(within(drawer).getByTestId(`${D}-step-next-trigger`));
    expect(await within(drawer).findByTestId(`${D}-offerings-planned`)).toHaveTextContent(
      'Hydrafacial',
    );
    expect(within(drawer).queryByTestId(`${D}-offerings`)).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-step-now-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-feel-much_better`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Check-in updated'),
    );
    expect(updateCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: TEST_PATIENT_ID,
        checkInId: 'chk_saved',
        expectedUpdatedAt: saved.updatedAt,
        fields: expect.objectContaining({ feel: 'much_better', score: 7 }),
      }),
    );
  });

  it('reloads a check-in someone saved meanwhile (`409 record_changed`)', async () => {
    const saved = checkIn({ id: 'chk_saved' });
    vi.mocked(updateCheckIn).mockRejectedValue(
      new HttpError('Conflict', 409, '/app/patients/x/check-ins/y', 'PATCH', {
        error: { reason: 'record_changed', detail: 'This record was changed' },
      }),
    );
    vi.mocked(fetchCheckIn).mockResolvedValue(
      checkIn({ id: 'chk_saved', feel: 'worse', updatedAt: '2026-10-10T09:00:00.000Z' }),
    );
    const { user, drawer } = await open({ checkIn: saved });
    await user.click(within(drawer).getByTestId(`${D}-feel-same`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-feel-worse`)).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(fetchCheckIn).toHaveBeenCalledWith(TEST_PATIENT_ID, 'chk_saved');
  });
});
