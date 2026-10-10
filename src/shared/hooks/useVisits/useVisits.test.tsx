import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClinicalNote } from '@/shared/api/clinic/clinical-notes-contracts.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import {
  fetchOpenVisit,
  fetchVisitCheckNotes,
  recordVisitCheck,
  removeVisitCheck,
  setVisitPaused,
  startVisit,
} from '@/shared/api/clinic/visits-api.ts';
import type { VisitRecord } from '@/shared/api/clinic/visits-contracts.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import {
  appointmentRow,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  patientFile,
  patientRecord,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';

import {
  useOpenVisit,
  useSetVisitCheck,
  useSetVisitPaused,
  useStartVisit,
  useVisitChecks,
} from './useVisits.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/api/clinic/patient-file-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatientFile: vi.fn(),
}));
vi.mock('@/shared/api/clinic/visits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchOpenVisit: vi.fn(),
  fetchVisitCheckNotes: vi.fn(),
  recordVisitCheck: vi.fn(),
  removeVisitCheck: vi.fn(async () => undefined),
  setVisitPaused: vi.fn(),
  startVisit: vi.fn(async () => undefined),
}));
const membership = vi.hoisted(() => ({ id: null as string | null }));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => membership.id),
}));

const APPOINTMENT_ID = 'appt_priya000000000000000';

/** Priya's visit, checked in and with the doctor. */
const VISIT: VisitRecord = {
  appointmentId: APPOINTMENT_ID,
  booking: appointmentRow({
    id: APPOINTMENT_ID,
    contactId: TEST_CONTACT_ID,
    patientId: TEST_PATIENT_ID,
    status: 'checked_in',
  }),
  stage: 'with_doctor',
  stageAt: '2026-10-03T03:35:00.000Z',
  pausedAt: null,
};

/** A safety-check note at the visit. */
const checkNote = (id: string, text: string): ClinicalNote => ({
  id,
  patientId: TEST_PATIENT_ID,
  kind: 'safety_check',
  text,
  appointmentId: APPOINTMENT_ID,
  diagnosisId: null,
  addedAt: '2026-10-03T05:00:00.000Z',
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions(['organization:read', 'appointment:read']);
  membership.id = null;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(fetchPatientFile).mockResolvedValue(patientFile());
  vi.mocked(fetchOpenVisit).mockResolvedValue(VISIT);
  vi.mocked(notify.error).mockClear();
});
afterEach(() => {
  client.clear();
  vi.mocked(startVisit).mockClear();
  vi.mocked(fetchOpenVisit).mockReset();
  vi.mocked(fetchVisitCheckNotes).mockReset();
  vi.mocked(recordVisitCheck).mockReset();
  vi.mocked(removeVisitCheck).mockClear();
  vi.mocked(setVisitPaused).mockReset();
});

describe('useOpenVisit', () => {
  it('reads the open visit of the file’s person, once the file has answered', async () => {
    const { result } = renderHook(() => useOpenVisit(TEST_PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(VISIT));
    expect(fetchPatientFile).toHaveBeenCalledWith(TEST_PATIENT_ID);
    expect(fetchOpenVisit).toHaveBeenCalledWith(TEST_CONTACT_ID);
  });

  it('asks nothing for a member who can’t read the bookings — no open visit', async () => {
    act(() => useOrganizationStore.getState().setPermissions(['organization:read']));
    const { result } = renderHook(() => useOpenVisit(TEST_PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fetchOpenVisit).not.toHaveBeenCalled();
  });

  it('is idle without a patient, and without an organization', async () => {
    const none = renderHook(() => useOpenVisit(''), { wrapper });
    expect(none.result.current.fetchStatus).toBe('idle');
    act(() => useOrganizationStore.getState().clearOrganization());
    const signedOut = renderHook(() => useOpenVisit(TEST_PATIENT_ID), { wrapper });
    expect(signedOut.result.current.fetchStatus).toBe('idle');
    expect(fetchOpenVisit).not.toHaveBeenCalled();
  });
});

describe('useStartVisit', () => {
  it('starts the visit of the file’s person at the home branch, with the doctor given', async () => {
    const { result } = renderHook(() => useStartVisit(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        patientId: TEST_PATIENT_ID,
        doctorId: DOCTOR_ARJUN.id,
      }),
    );
    expect(startVisit).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      branchId: TEST_BRANCH_ID,
      doctorId: DOCTOR_ARJUN.id,
      idempotencyKey: expect.any(String),
    });
  });

  it('falls back to the patient’s usual doctor, then the signed-in member', async () => {
    vi.mocked(fetchPatientFile).mockResolvedValue(
      patientFile({ patient: patientRecord({ doctorId: DOCTOR_NISHA.id }) }),
    );
    const usual = renderHook(() => useStartVisit(), { wrapper });
    await act(() => usual.result.current.mutateAsync({ patientId: TEST_PATIENT_ID }));
    expect(startVisit).toHaveBeenLastCalledWith(
      expect.objectContaining({ doctorId: DOCTOR_NISHA.id }),
    );

    client.clear();
    vi.mocked(fetchPatientFile).mockResolvedValue(patientFile());
    membership.id = 'mem_me000000000000000000';
    const mine = renderHook(() => ({ start: useStartVisit(), me: useMyMembershipId() }), {
      wrapper,
    });
    await waitFor(() => expect(mine.result.current.me).toBe('mem_me000000000000000000'));
    await act(() =>
      mine.result.current.start.mutateAsync({ patientId: TEST_PATIENT_ID }),
    );
    expect(startVisit).toHaveBeenLastCalledWith(
      expect.objectContaining({ doctorId: 'mem_me000000000000000000' }),
    );
  });

  it('starts nothing for a member with no membership to book with, and says so', async () => {
    const { result } = renderHook(
      () => ({ start: useStartVisit(), me: useMyMembershipId() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.me).toBeNull());
    await act(async () => {
      await result.current.start
        .mutateAsync({ patientId: TEST_PATIENT_ID })
        .catch(() => undefined);
    });
    expect(startVisit).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });
});

describe('useSetVisitPaused', () => {
  it('pauses and resumes the visit', async () => {
    vi.mocked(setVisitPaused).mockResolvedValue(VISIT);
    const { result } = renderHook(() => useSetVisitPaused(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ appointmentId: APPOINTMENT_ID, paused: true }),
    );
    expect(setVisitPaused).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      paused: true,
      idempotencyKey: expect.any(String),
    });
  });
});

describe('the safety checks', () => {
  const target = { patientId: TEST_PATIENT_ID, appointmentId: APPOINTMENT_ID };

  it('reads the visit’s check notes — idle while not allowed or without a visit', async () => {
    vi.mocked(fetchVisitCheckNotes).mockResolvedValue([
      checkNote('pcn_consent', 'Consent signed'),
    ]);
    const { result } = renderHook(
      () => ({
        read: useVisitChecks(target),
        barred: useVisitChecks(target, { enabled: false }),
        none: useVisitChecks(null),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.read.data).toHaveLength(1));
    expect(fetchVisitCheckNotes).toHaveBeenCalledTimes(1);
    expect(result.current.barred.fetchStatus).toBe('idle');
    expect(result.current.none.fetchStatus).toBe('idle');
  });

  it('ticks a check at once — a note in flight — and keeps the server’s once it answers', async () => {
    const saved = checkNote('pcn_photos', 'Before photos taken');
    const pending: { answer?: (note: ClinicalNote) => void } = {};
    vi.mocked(fetchVisitCheckNotes).mockResolvedValueOnce([]);
    vi.mocked(recordVisitCheck).mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.answer = resolve;
        }),
    );
    const { result } = renderHook(
      () => ({ read: useVisitChecks(target), set: useSetVisitCheck(target) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.read.data).toEqual([]));
    act(() => result.current.set.mutate({ check: 'photos', noteId: null }));
    await waitFor(() =>
      expect(result.current.read.data).toEqual([
        expect.objectContaining({ id: '', text: 'Before photos taken' }),
      ]),
    );
    vi.mocked(fetchVisitCheckNotes).mockResolvedValueOnce([saved]);
    await act(async () => pending.answer?.(saved));
    await waitFor(() => expect(result.current.read.data).toEqual([saved]));
    expect(recordVisitCheck).toHaveBeenCalledWith({
      ...target,
      check: 'photos',
      idempotencyKey: expect.any(String),
    });
  });

  it('unticks a check by removing its note, and puts it back if refused', async () => {
    const consent = checkNote('pcn_consent', 'Consent signed');
    vi.mocked(fetchVisitCheckNotes).mockResolvedValue([consent]);
    vi.mocked(removeVisitCheck).mockRejectedValueOnce(new Error('refused'));
    const { result } = renderHook(
      () => ({ read: useVisitChecks(target), set: useSetVisitCheck(target) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.read.data).toEqual([consent]));
    await act(async () => {
      await result.current.set
        .mutateAsync({ check: 'consent', noteId: 'pcn_consent' })
        .catch(() => undefined);
    });
    expect(removeVisitCheck).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      noteId: 'pcn_consent',
    });
    await waitFor(() => expect(result.current.read.data).toEqual([consent]));
    await act(() =>
      result.current.set.mutateAsync({ check: 'consent', noteId: 'pcn_consent' }),
    );
    expect(removeVisitCheck).toHaveBeenCalledTimes(2);
  });
});
