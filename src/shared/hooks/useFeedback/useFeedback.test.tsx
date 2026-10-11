import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import type * as FeedbackApiModule from '@/shared/api/app/feedback-api.ts';
import {
  createCheckIn,
  deleteFeedback,
  fetchPreviousCheckIn,
  logFeedbackAction,
  restoreFeedback,
  updateCheckIn,
} from '@/shared/api/app/feedback-api.ts';
import type {
  FeedbackItem,
  PatientCheckIn,
} from '@/shared/api/app/feedback-contracts.ts';
import { patientFileQueryKeys } from '@/shared/api/app/patient-file-api.ts';
import type * as TreatmentsApiModule from '@/shared/api/app/treatments-api.ts';
import { treatmentQueryKeys } from '@/shared/api/app/treatments-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  useCheckInContext,
  useCreateCheckIn,
  useDeleteFeedback,
  useLogFeedbackAction,
  usePatientFeedback,
  useRestoreFeedback,
  useUpdateCheckIn,
} from './useFeedback.ts';

/** A check-in as the file reads it — a visit check-in, Better at 7. */
function checkIn(overrides: Partial<PatientCheckIn> = {}): PatientCheckIn {
  return {
    id: 'chk_first0000000000000000',
    patientId: TEST_PATIENT_ID,
    appointmentId: null,
    treatmentId: null,
    context: 'Visit · 24 Sep',
    feel: 'better',
    score: 7,
    scoreChange: null,
    followed: null,
    followedNote: null,
    currentState: 'Less redness',
    nextPlan: null,
    nextOfferingIds: [],
    date: '2026-09-24',
    needsAction: false,
    actions: [],
    createdAt: '2026-09-24T05:00:00.000Z',
    updatedAt: '2026-09-24T05:00:00.000Z',
    ...overrides,
  };
}

/** The server's records — every write shows in the next read. */
const store = vi.hoisted(() => ({ items: [] as FeedbackItem[] }));

vi.mock('@/shared/api/app/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof FeedbackApiModule>()),
  listPatientFeedback: vi.fn(async () => [...store.items]),
  fetchPreviousCheckIn: vi.fn(async () => null),
  createCheckIn: vi.fn(),
  updateCheckIn: vi.fn(),
  deleteFeedback: vi.fn(),
  restoreFeedback: vi.fn(),
  logFeedbackAction: vi.fn(),
}));
vi.mock('@/shared/api/app/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TreatmentsApiModule>()),
  fetchTreatment: vi.fn(async () => ({ id: 'trt_lhr', name: 'LHR Full Face' })),
}));
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppointmentsApiModule>()),
  fetchAppointment: vi.fn(async () =>
    appointmentRow({ id: 'appt_visit', serviceLabel: 'Hydrafacial' }),
  ),
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  signInTestMember();
  store.items = [
    { kind: 'checkIn', id: 'chk_first0000000000000000', checkIn: checkIn() },
  ];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  vi.resetAllMocks();
  useOrganizationStore.getState().clearOrganization();
});

describe('useFeedback', () => {
  it('reads the cards only once the organization is known, and when asked', async () => {
    useOrganizationStore.getState().clearOrganization();
    const idle = renderHook(() => usePatientFeedback(TEST_PATIENT_ID), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    idle.unmount();
    signInTestMember();
    const closed = renderHook(
      () => usePatientFeedback(TEST_PATIENT_ID, { enabled: false }),
      { wrapper },
    );
    expect(closed.result.current.fetchStatus).toBe('idle');
    closed.unmount();
    const { result } = renderHook(() => usePatientFeedback(TEST_PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('logs a check-in with the write’s key and refreshes the cards, the rail and the treatments', async () => {
    vi.mocked(createCheckIn).mockImplementation(async ({ input }) => {
      const saved = checkIn({ id: 'chk_second', ...input });
      store.items = [{ kind: 'checkIn', id: saved.id, checkIn: saved }, ...store.items];
      return saved;
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ cards: usePatientFeedback(TEST_PATIENT_ID), create: useCreateCheckIn() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.cards.data).toHaveLength(1));
    await act(() =>
      result.current.create.mutateAsync({
        patientId: TEST_PATIENT_ID,
        input: {
          feel: 'worse',
          score: 3,
          currentState: null,
          followed: null,
          followedNote: null,
          nextPlan: null,
          appointmentId: null,
          treatmentId: null,
          date: '2026-10-10',
          nextOfferingIds: [],
        },
      }),
    );
    expect(createCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: TEST_PATIENT_ID,
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(result.current.cards.data).toHaveLength(2));
    const refreshed = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(refreshed).toEqual(
      expect.arrayContaining([patientFileQueryKeys.all, treatmentQueryKeys.all]),
    );
  });

  it('saves a check-in’s changes against the version read', async () => {
    const read = checkIn({ updatedAt: '2026-09-24T06:00:00.000Z' });
    vi.mocked(updateCheckIn).mockResolvedValue(read);
    const { result } = renderHook(() => useUpdateCheckIn(), { wrapper });
    const fields = {
      feel: 'much_better',
      score: 9,
      currentState: null,
      followed: null,
      followedNote: null,
      nextPlan: null,
    } as const;
    await act(() => result.current.mutateAsync({ checkIn: read, fields }));
    expect(updateCheckIn).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      checkInId: read.id,
      fields,
      expectedUpdatedAt: '2026-09-24T06:00:00.000Z',
      idempotencyKey: expect.any(String),
    });
  });

  it('removes a card for a reason, brings it back, and logs a follow-up on it', async () => {
    const { result } = renderHook(
      () => ({
        remove: useDeleteFeedback(),
        restore: useRestoreFeedback(),
        log: useLogFeedbackAction(),
      }),
      { wrapper },
    );
    const record = { patientId: TEST_PATIENT_ID, kind: 'review', id: 'rev_low' } as const;
    await act(() =>
      result.current.remove.mutateAsync({ ...record, reason: 'duplicate', note: null }),
    );
    expect(deleteFeedback).toHaveBeenCalledWith(
      { ...record, reason: 'duplicate', note: null },
      expect.anything(),
    );
    await act(() => result.current.restore.mutateAsync(record));
    expect(restoreFeedback).toHaveBeenCalledWith({
      ...record,
      idempotencyKey: expect.any(String),
    });
    await act(() =>
      result.current.log.mutateAsync({ ...record, action: 'replied_google' }),
    );
    expect(logFeedbackAction).toHaveBeenCalledWith({
      ...record,
      action: 'replied_google',
      note: null,
      idempotencyKey: expect.any(String),
    });
  });

  it('heads the drawer with the check-in before, the treatment and the visit', async () => {
    const editing = checkIn({ id: 'chk_editing' });
    const { result } = renderHook(
      () =>
        useCheckInContext(TEST_PATIENT_ID, {
          appointmentId: 'appt_visit',
          treatmentId: 'trt_lhr',
          editing,
        }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current).toEqual({
        previous: null,
        treatmentName: 'LHR Full Face',
        visitService: 'Hydrafacial',
      }),
    );
    expect(fetchPreviousCheckIn).toHaveBeenCalledWith(TEST_PATIENT_ID, editing);
  });

  it('reads neither the treatment nor the visit when the check-in follows none', async () => {
    const { result } = renderHook(
      () =>
        useCheckInContext(TEST_PATIENT_ID, {
          appointmentId: null,
          treatmentId: null,
          editing: null,
        }),
      { wrapper },
    );
    await waitFor(() => expect(fetchPreviousCheckIn).toHaveBeenCalled());
    expect(result.current).toEqual({
      previous: null,
      treatmentName: null,
      visitService: null,
    });
  });
});
