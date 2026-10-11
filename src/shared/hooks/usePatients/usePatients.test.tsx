import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatients: vi.fn(),
  fetchPatient: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatient: vi.fn(),
  restorePatient: vi.fn(),
}));
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findContactByPhone: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import { findContactByPhone } from '@/shared/api/app/contacts-api.ts';
import {
  createPatient,
  deletePatient,
  fetchPatient,
  listPatients,
  patientQueryKeys,
  restorePatient,
  updatePatient,
} from '@/shared/api/app/patients-api.ts';
import type { PatientFields } from '@/shared/api/app/patients-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { contactHit } from '@/tests/utils/appointment-doubles.ts';
import { EMPTY_CONTACT_PROFILE } from '@/tests/utils/contact-doubles.ts';
import {
  patientRecord,
  patientRow,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';

import {
  useCreatePatient,
  useDeletePatient,
  usePatient,
  usePatientList,
  usePersonByPhone,
  useRestorePatient,
  useUpdatePatient,
} from './usePatients.ts';

const FIELDS: PatientFields = {
  firstName: 'Priya',
  lastName: 'Shah',
  phone: '+919876543210',
  phone2: null,
  gender: 'female',
  dateOfBirth: null,
  address: null,
  referralSource: null,
  referredByName: null,
  homeBranchId: 'brn_main0000000000000000',
  types: ['aesthetic'],
  status: 'new',
  conversion: null,
  followUpAt: null,
  notes: null,
  consents: [],
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('usePatientList', () => {
  it('reads cursor pages for the params, under the organization', async () => {
    vi.mocked(listPatients)
      .mockResolvedValueOnce({ rows: [patientRow()], next: 'cur_2', total: 2 })
      .mockResolvedValueOnce({
        rows: [patientRow({ id: 'pat_kavya0000000000000000', seq: 3507 })],
        next: null,
        total: 2,
      });
    const { result } = renderHook(() => usePatientList({ view: 'follow' }), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(listPatients).toHaveBeenCalledWith({ view: 'follow' }, undefined);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(listPatients).toHaveBeenLastCalledWith({ view: 'follow' }, 'cur_2');
    expect(result.current.hasNextPage).toBe(false);
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => usePatientList({}), { wrapper });
    expect(listPatients).not.toHaveBeenCalled();
  });
});

describe('usePatient', () => {
  it('reads one patient, and stays idle without an id', async () => {
    vi.mocked(fetchPatient).mockResolvedValue(patientRecord());
    const { result, rerender } = renderHook(({ id }) => usePatient(id), {
      wrapper,
      initialProps: { id: undefined as string | undefined },
    });
    expect(fetchPatient).not.toHaveBeenCalled();

    rerender({ id: TEST_PATIENT_ID });
    await waitFor(() => expect(result.current.data?.name).toBe('Priya Shah'));
    expect(fetchPatient).toHaveBeenCalledWith(TEST_PATIENT_ID);
  });
});

describe('usePersonByPhone', () => {
  it('looks the number up once there is one', async () => {
    vi.mocked(findContactByPhone).mockResolvedValue({
      ...contactHit({ patientId: TEST_PATIENT_ID }),
      ...EMPTY_CONTACT_PROFILE,
      patientNumber: 3508,
    });
    const { result, rerender } = renderHook(({ phone }) => usePersonByPhone(phone), {
      wrapper,
      initialProps: { phone: null as string | null },
    });
    expect(findContactByPhone).not.toHaveBeenCalled();

    rerender({ phone: '+919825011241' });
    await waitFor(() => expect(result.current.data?.patientNumber).toBe(3508));
    expect(findContactByPhone).toHaveBeenCalledWith('+919825011241');
  });
});

describe('writes', () => {
  it('creates with the action key and refreshes the lists', async () => {
    vi.mocked(createPatient).mockResolvedValue(patientRecord());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreatePatient(), { wrapper });

    await act(() => result.current.mutateAsync({ fields: FIELDS, person: 'new' }));

    expect(createPatient).toHaveBeenCalledWith({
      fields: FIELDS,
      person: 'new',
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: patientQueryKeys.all }),
    );
  });

  it('saves the record as read with the drawer fields', async () => {
    const record = patientRecord();
    vi.mocked(updatePatient).mockResolvedValue(record);
    const { result } = renderHook(() => useUpdatePatient(), { wrapper });

    await act(() => result.current.mutateAsync({ record, fields: FIELDS }));

    expect(updatePatient).toHaveBeenCalledWith({
      record,
      fields: FIELDS,
      idempotencyKey: expect.any(String),
    });
  });

  it('takes a deleted patient out of every list at once, and puts them back with restore', async () => {
    let land: () => void = () => undefined;
    vi.mocked(deletePatient).mockReturnValue(
      new Promise<void>((resolve) => {
        land = resolve;
      }),
    );
    vi.mocked(restorePatient).mockResolvedValue(patientRecord());
    const key = patientQueryKeys.list('org_test', { view: 'all' });
    client.setQueryData(key, {
      pages: [{ rows: [patientRow()], next: null, hasMore: false }],
      pageParams: [null],
    });
    const { result } = renderHook(
      () => ({ remove: useDeletePatient(), restore: useRestorePatient() }),
      { wrapper },
    );

    let deleting: Promise<void> = Promise.resolve();
    act(() => {
      deleting = result.current.remove.mutateAsync({
        id: TEST_PATIENT_ID,
        reason: 'duplicate',
        note: null,
      });
    });
    await waitFor(() =>
      expect(
        client.getQueryData<{ pages: { rows: unknown[] }[] }>(key)?.pages[0]?.rows,
      ).toEqual([]),
    );
    land();
    await act(() => deleting);
    expect(deletePatient).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      reason: 'duplicate',
      note: null,
    });

    await act(() => result.current.restore.mutateAsync(TEST_PATIENT_ID));
    expect(restorePatient).toHaveBeenCalledWith(TEST_PATIENT_ID, expect.any(String));
  });
});
