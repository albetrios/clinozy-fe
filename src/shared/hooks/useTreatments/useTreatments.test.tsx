import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TreatmentsApiModule from '@/shared/api/app/treatments-api.ts';
import {
  createTreatment,
  listPatientTreatments,
  listTreatmentCheckIns,
  reverseTreatment,
  updateTreatment,
} from '@/shared/api/app/treatments-api.ts';
import type {
  TreatmentFields,
  TreatmentRecord,
} from '@/shared/api/app/treatments-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import {
  useCreateTreatment,
  usePatientTreatments,
  useReverseTreatment,
  useTreatmentFeedback,
  useUpdateTreatment,
} from './useTreatments.ts';

vi.mock('@/shared/api/app/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TreatmentsApiModule>()),
  listPatientTreatments: vi.fn(),
  listTreatmentCheckIns: vi.fn(),
  createTreatment: vi.fn(),
  updateTreatment: vi.fn(),
  reverseTreatment: vi.fn(),
}));

const PATIENT_ID = 'pat_priya0000000000000000';

/** A done session on no package. */
function treatmentRecord(overrides: Partial<TreatmentRecord> = {}): TreatmentRecord {
  return {
    id: 'trt_lhr00000000000000000',
    patientId: PATIENT_ID,
    appointmentId: null,
    offeringId: null,
    name: 'LHR Full Face',
    template: 'skin',
    performedAt: '2026-10-10T01:41:02.988Z',
    doctorId: null,
    therapistId: null,
    bodyParts: ['face'],
    sessionNumber: 1,
    parameters: {},
    remark: null,
    aftercareCall: 'next_day',
    packageId: null,
    isBilled: null,
    status: 'done',
    reversedReason: null,
    reversedAt: null,
    latestCheckIn: null,
    createdAt: '2026-10-10T01:41:02.988Z',
    updatedAt: '2026-10-10T01:41:02.988Z',
    ...overrides,
  };
}

const FIELDS: TreatmentFields = {
  name: 'Back Peeling',
  template: 'skin',
  offeringId: null,
  doctorId: null,
  therapistId: null,
  bodyParts: ['back'],
  sessionNumber: 1,
  parameters: { type: 'Peel' },
  remark: null,
  aftercareCall: 'next_day',
};

/** The server the mocked api serves. */
let stored: TreatmentRecord[] = [];
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  signInTestMember();
  stored = [treatmentRecord()];
  vi.mocked(listPatientTreatments).mockImplementation(async () => [...stored]);
  vi.mocked(listTreatmentCheckIns).mockResolvedValue([
    { id: 'chk_one00000000000000000', date: '2026-10-11', feel: 'better', score: 7 },
  ]);
  vi.mocked(createTreatment).mockImplementation(async ({ input }) => {
    const saved = treatmentRecord({
      ...input,
      id: 'trt_new00000000000000000',
      packageId: input.packageId,
    });
    stored = [saved, ...stored];
    return saved;
  });
  vi.mocked(updateTreatment).mockImplementation(async ({ treatment, fields }) => {
    const saved = { ...treatment, ...fields, updatedAt: '2026-10-10T03:00:00.000Z' };
    stored = stored.map((row) => (row.id === saved.id ? saved : row));
    return saved;
  });
  vi.mocked(reverseTreatment).mockImplementation(async ({ treatment, reason }) => {
    const saved: TreatmentRecord = {
      ...treatment,
      status: 'reversed',
      reversedReason: reason,
      packageId: null,
    };
    stored = stored.map((row) => (row.id === saved.id ? saved : row));
    return saved;
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('usePatientTreatments', () => {
  it('reads a patient’s sessions', async () => {
    const { result } = renderHook(() => usePatientTreatments(PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(listPatientTreatments).toHaveBeenCalledWith(PATIENT_ID);
  });

  it('stays idle without a patient, or while a caller holds it off', () => {
    const none = renderHook(() => usePatientTreatments(''), { wrapper });
    const held = renderHook(() => usePatientTreatments(PATIENT_ID, { enabled: false }), {
      wrapper,
    });
    expect(none.result.current.fetchStatus).toBe('idle');
    expect(held.result.current.fetchStatus).toBe('idle');
    expect(listPatientTreatments).not.toHaveBeenCalled();
  });
});

describe('useTreatmentFeedback', () => {
  it('reads one session’s check-ins, and nothing without a session', async () => {
    const { result } = renderHook(
      () => ({
        open: useTreatmentFeedback(PATIENT_ID, 'trt_lhr00000000000000000'),
        none: useTreatmentFeedback(PATIENT_ID, null),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.open.data).toHaveLength(1));
    expect(listTreatmentCheckIns).toHaveBeenCalledTimes(1);
    expect(listTreatmentCheckIns).toHaveBeenCalledWith(
      PATIENT_ID,
      'trt_lhr00000000000000000',
    );
    expect(result.current.none.fetchStatus).toBe('idle');
  });
});

describe('the treatment writes', () => {
  function renderWrites() {
    return renderHook(
      () => ({
        list: usePatientTreatments(PATIENT_ID),
        create: useCreateTreatment(),
        update: useUpdateTreatment(),
        reverse: useReverseTreatment(),
      }),
      { wrapper },
    );
  }

  it('records a session with the action’s key and refreshes the list', async () => {
    const { result } = renderWrites();
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    await act(() =>
      result.current.create.mutateAsync({
        patientId: PATIENT_ID,
        input: { ...FIELDS, packageId: 'poff_lhr0000000000000000' },
      }),
    );
    expect(createTreatment).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      input: { ...FIELDS, packageId: 'poff_lhr0000000000000000' },
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
  });

  it('saves a change and reverses a session, each refreshing the list', async () => {
    const { result } = renderWrites();
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    const [session] = stored;
    if (!session) throw new Error('no session');
    await act(() =>
      result.current.update.mutateAsync({
        treatment: session,
        fields: { ...FIELDS, remark: 'Settled' },
      }),
    );
    expect(updateTreatment).toHaveBeenCalledWith({
      treatment: session,
      fields: { ...FIELDS, remark: 'Settled' },
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(result.current.list.data?.[0]?.remark).toBe('Settled'));

    await act(() =>
      result.current.reverse.mutateAsync({
        treatment: stored[0] ?? session,
        reason: 'Wrong patient',
      }),
    );
    expect(reverseTreatment).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Wrong patient',
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(result.current.list.data?.[0]).toMatchObject({
        status: 'reversed',
        reversedReason: 'Wrong patient',
      }),
    );
  });
});
