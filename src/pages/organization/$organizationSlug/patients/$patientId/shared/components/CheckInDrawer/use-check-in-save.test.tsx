import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PatientCheckIn } from '@/shared/api/app/feedback-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

const { notifyMock, feedbackApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  feedbackApi: { createCheckIn: vi.fn(), updateCheckIn: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...feedbackApi,
}));

import {
  checkInFormOf,
  type CheckInFormValues,
  newCheckInForm,
} from './check-in-form.ts';
import { useCheckInSave } from './use-check-in-save.ts';

const APPOINTMENT_ID = 'appt_visit000000000000000';
const TREATMENT_ID = 'trt_lhr00000000000000000';
const HYDRAFACIAL = 'off_hydra0000000000000000';

/** A check-in as the file reads it — the visit before, Better at 7. */
const checkIn = (overrides: Partial<PatientCheckIn> = {}): PatientCheckIn => ({
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
  currentState: 'Mild redness settled',
  nextPlan: 'Sunscreen every day',
  nextOfferingIds: [],
  date: '2026-09-24',
  needsAction: false,
  actions: [],
  createdAt: '2026-09-24T05:00:00.000Z',
  updatedAt: '2026-09-24T05:00:00.000Z',
  ...overrides,
});

const PLACE = {
  patientId: TEST_PATIENT_ID,
  appointmentId: APPOINTMENT_ID,
  treatmentId: TREATMENT_ID,
  date: '2026-10-12',
};

const validation = (field: string, message: string) =>
  new HttpError('HTTP 400', 400, '/api/v1/app/patients/x/check-ins', 'POST', {
    error: { type: 'validation_error', errors: [{ field, message }] },
  });

describe('useCheckInSave — the check-in’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    saved = null,
    values,
    onStale,
  }: {
    saved?: PatientCheckIn | null;
    values: CheckInFormValues;
    onStale?: () => void;
  }) {
    const onStep = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<CheckInFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useCheckInSave({
            form,
            checkIn: saved,
            place: PLACE,
            onStep,
            onStale,
            onDone,
          }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [...Object.values(notifyMock), ...Object.values(feedbackApi)]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  it('asks how it is now, then the score — the first step opens for each', async () => {
    const noFeel = render({ values: { ...newCheckInForm(), score: 6 } });
    await act(() => noFeel.result.current.drawer.save());
    expect(noFeel.onStep).toHaveBeenCalledWith('now');
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick how it is now');

    const noScore = render({ values: { ...newCheckInForm(), feel: 'same' } });
    await act(() => noScore.result.current.drawer.save());
    expect(noScore.result.current.form.getFieldState('score').error?.message).toBe(
      'Pick the patient’s score',
    );
    expect(feedbackApi.createCheckIn).not.toHaveBeenCalled();
  });

  it('writes a new check-in at its visit, treatment and day, with the offerings to plan', async () => {
    const written = checkIn({ id: 'chk_new000000000000000000' });
    feedbackApi.createCheckIn.mockResolvedValue(written);
    const { result, onDone } = render({
      values: {
        ...newCheckInForm(),
        feel: 'worse',
        score: 3,
        currentState: '  ',
        nextPlan: ' Call back ',
        nextOfferingIds: [HYDRAFACIAL],
      },
    });

    await act(() => result.current.drawer.save());

    expect(feedbackApi.createCheckIn).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      input: {
        feel: 'worse',
        score: 3,
        currentState: null,
        followed: null,
        followedNote: null,
        nextPlan: 'Call back',
        appointmentId: APPOINTMENT_ID,
        treatmentId: TREATMENT_ID,
        date: '2026-10-12',
        nextOfferingIds: [HYDRAFACIAL],
      },
      idempotencyKey: expect.any(String),
    });
    expect(onDone).toHaveBeenCalledWith(written, false);
  });

  it('saves an edit with the check-in’s updated_at — never moving its place', async () => {
    const saved = checkIn();
    feedbackApi.updateCheckIn.mockResolvedValue({ ...saved, score: 8 });
    const { result } = render({ saved, values: { ...checkInFormOf(saved), score: 8 } });

    await act(() => result.current.drawer.save());

    expect(feedbackApi.updateCheckIn).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      checkInId: saved.id,
      fields: expect.objectContaining({ feel: 'better', score: 8 }),
      expectedUpdatedAt: '2026-09-24T05:00:00.000Z',
      idempotencyKey: expect.any(String),
    });
    const [vars] = feedbackApi.updateCheckIn.mock.lastCall as [{ fields: object }];
    expect(vars.fields).not.toHaveProperty('appointmentId');
    expect(feedbackApi.createCheckIn).not.toHaveBeenCalled();
  });

  it('puts a refused field on its own and opens its step', async () => {
    const cases: [string, keyof CheckInFormValues, string][] = [
      ['body.followed_note', 'followedNote', 'followed'],
      ['body.next_plan', 'nextPlan', 'next'],
      ['body.score', 'score', 'now'],
    ];
    for (const [field, formField, step] of cases) {
      feedbackApi.createCheckIn.mockRejectedValueOnce(validation(field, 'Refused'));
      const { result, onStep } = render({
        values: { ...newCheckInForm(), feel: 'better', score: 7 },
      });
      await act(() => result.current.drawer.save());
      expect(result.current.form.getFieldState(formField).error?.message).toBe('Refused');
      expect(onStep).toHaveBeenCalledWith(step);
    }
  });

  it('offers Reload for a stale edit', async () => {
    const saved = checkIn();
    const onStale = vi.fn();
    feedbackApi.updateCheckIn.mockRejectedValue(
      new HttpError('HTTP 409', 409, '/x', 'PATCH', {
        error: { reason: 'record_changed', detail: 'Changed by usr_x' },
      }),
    );
    const { result } = render({ saved, values: checkInFormOf(saved), onStale });

    await act(() => result.current.drawer.save());

    const [, options] = notifyMock.error.mock.lastCall as [
      string,
      { id: string; action: { onClick: () => void } },
    ];
    expect(options.id).toBe('check-in-save-failed');
    options.action.onClick();
    expect(onStale).toHaveBeenCalledOnce();
  });
});
