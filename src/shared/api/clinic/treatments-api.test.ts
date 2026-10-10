import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import { patientQueryKeys } from './patients-api.ts';
import {
  createTreatment,
  fetchTreatment,
  listPatientTreatments,
  listTreatmentCheckIns,
  reverseTreatment,
  treatmentQueryKeys,
  updateTreatment,
} from './treatments-api.ts';
import type { TreatmentFields, TreatmentRecord } from './treatments-contracts.ts';

const PATIENT_ID = 'pat_priya0000000000000000';
const TREATMENT_ID = 'trt_lhr00000000000000000';
const PACKAGE_ID = 'poff_lhr0000000000000000';
const NISHA = 'mem_nisha0000000000000000';
const KEY = 'key-1';

/** A session as clinozy-be answers it (checked against the live answer, 2026-10-10). */
const treatmentRow = (patch: Record<string, unknown> = {}) => ({
  id: TREATMENT_ID,
  patient_id: PATIENT_ID,
  appointment_id: null,
  offering_id: 'off_lhr00000000000000000',
  name: 'LHR Full Face',
  template: 'skin',
  performed_at: '2026-10-10T01:41:02.988Z',
  doctor_membership_id: NISHA,
  therapist_membership_id: null,
  body_parts: ['face', 'upper_lip'],
  session_number: 2,
  parameters: { type: 'Laser', areas: 'Face, Upper lip', wavelength: '810' },
  remark: 'Mild redness',
  aftercare_call: 'in_two_days',
  patient_offering_id: PACKAGE_ID,
  is_billed: true,
  status: 'done',
  reversed_reason: null,
  reversed_at: null,
  latest_check_in: {
    id: 'chk_one00000000000000000',
    feel: 'better',
    score: 7,
    check_in_date: '2026-10-10',
  },
  created_at: '2026-10-10T01:41:02.988Z',
  updated_at: '2026-10-10T01:41:12.606Z',
  ...patch,
});

/** One list page as clinozy-be answers it. */
const page = (rows: unknown[], next: string | null = null) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 100, next, has_more: next !== null },
  },
});

/** Every field a drawer save sends. */
const FIELDS: TreatmentFields = {
  name: 'LHR Full Face',
  template: 'skin',
  offeringId: 'off_lhr00000000000000000',
  doctorId: NISHA,
  therapistId: null,
  bodyParts: ['face'],
  sessionNumber: 3,
  parameters: { type: 'Laser' },
  remark: null,
  aftercareCall: 'next_day',
};

/** The session as the file reads it. */
async function readSession(
  patch: Record<string, unknown> = {},
): Promise<TreatmentRecord> {
  vi.mocked(api.get).mockResolvedValueOnce({ data: treatmentRow(patch) } as never);
  return fetchTreatment(PATIENT_ID, TREATMENT_ID);
}

const lastInit = (call: { mock: { lastCall?: unknown[] } }) =>
  call.mock.lastCall?.[1] as { body?: Record<string, unknown> } | undefined;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('treatmentQueryKeys', () => {
  it('sits under the patients key, so a patient write refreshes the sessions', () => {
    expect(treatmentQueryKeys.patient('org_a', PATIENT_ID).slice(0, 2)).toEqual([
      ...patientQueryKeys.all,
    ]);
    expect(treatmentQueryKeys.detail('org_a', PATIENT_ID, TREATMENT_ID)).toContain(
      'org_a',
    );
  });
});

describe('listPatientTreatments', () => {
  it('reads every page newest first and maps each session', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([treatmentRow()], 'cursor-2') as never)
      .mockResolvedValueOnce(
        page([
          treatmentRow({
            id: 'trt_old00000000000000000',
            status: 'reversed',
            reversed_reason: 'Wrong patient',
            reversed_at: '2026-10-10T02:00:00.000Z',
            patient_offering_id: null,
            latest_check_in: null,
          }),
        ]) as never,
      );
    const rows = await listPatientTreatments(PATIENT_ID);
    expect(api.get).toHaveBeenNthCalledWith(1, '/app/patients/{patient_id}/treatments', {
      params: { patient_id: PATIENT_ID },
      query: { sort: 'performed_at', order: 'desc', limit: 100, after: undefined },
    });
    expect(vi.mocked(api.get).mock.calls[1]?.[1]).toMatchObject({
      query: { after: 'cursor-2' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: TREATMENT_ID,
      patientId: PATIENT_ID,
      appointmentId: null,
      offeringId: 'off_lhr00000000000000000',
      name: 'LHR Full Face',
      template: 'skin',
      performedAt: '2026-10-10T01:41:02.988Z',
      doctorId: NISHA,
      therapistId: null,
      bodyParts: ['face', 'upper_lip'],
      sessionNumber: 2,
      parameters: { type: 'Laser', areas: 'Face, Upper lip', wavelength: '810' },
      remark: 'Mild redness',
      aftercareCall: 'in_two_days',
      packageId: PACKAGE_ID,
      isBilled: true,
      status: 'done',
      reversedReason: null,
      reversedAt: null,
      latestCheckIn: {
        id: 'chk_one00000000000000000',
        date: '2026-10-10',
        feel: 'better',
        score: 7,
      },
      createdAt: '2026-10-10T01:41:02.988Z',
      updatedAt: '2026-10-10T01:41:12.606Z',
    });
    expect(rows[1]).toMatchObject({
      status: 'reversed',
      reversedReason: 'Wrong patient',
      packageId: null,
      latestCheckIn: null,
    });
  });

  it('refuses an answer without the fields the file reads', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([{ ...treatmentRow(), session_number: undefined }]) as never,
    );
    await expect(listPatientTreatments(PATIENT_ID)).rejects.toThrow();
  });
});

describe('fetchTreatment and listTreatmentCheckIns', () => {
  it('reads one session by the patient and its id', async () => {
    const session = await readSession();
    expect(api.get).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/treatments/{patient_treatment_id}',
      { params: { patient_id: PATIENT_ID, patient_treatment_id: TREATMENT_ID } },
    );
    expect(session.id).toBe(TREATMENT_ID);
  });

  it('reads a session’s check-ins, newest first, for its feedback line', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        {
          id: 'chk_two00000000000000000',
          patient_id: PATIENT_ID,
          patient_treatment_id: TREATMENT_ID,
          feel: 'much_better',
          score: 9,
          check_in_date: '2026-10-12',
          needs_action: false,
        },
      ]) as never,
    );
    const checkIns = await listTreatmentCheckIns(PATIENT_ID, TREATMENT_ID);
    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: PATIENT_ID },
      query: {
        patient_treatment_id: TREATMENT_ID,
        sort: 'check_in_date',
        order: 'desc',
        limit: 100,
        after: undefined,
      },
    });
    expect(checkIns).toEqual([
      {
        id: 'chk_two00000000000000000',
        date: '2026-10-12',
        feel: 'much_better',
        score: 9,
      },
    ]);
  });
});

describe('createTreatment', () => {
  it('records a session with its number and offering, with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: treatmentRow() } as never);
    const saved = await createTreatment({
      patientId: PATIENT_ID,
      input: { ...FIELDS, packageId: null },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/patients/{patient_id}/treatments', {
      params: { patient_id: PATIENT_ID },
      body: {
        name: 'LHR Full Face',
        template: 'skin',
        offering_id: 'off_lhr00000000000000000',
        doctor_membership_id: NISHA,
        therapist_membership_id: null,
        body_parts: ['face'],
        session_number: 3,
        parameters: { type: 'Laser' },
        remark: null,
        aftercare_call: 'next_day',
      },
      idempotencyKey: KEY,
    });
    expect(saved.id).toBe(TREATMENT_ID);
  });

  it('spends a package session: the package goes, its number and offering do not (§6 #20)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: treatmentRow() } as never);
    await createTreatment({
      patientId: PATIENT_ID,
      input: {
        ...FIELDS,
        packageId: PACKAGE_ID,
        appointmentId: 'apt_visit000000000000000',
        performedAt: '2026-10-10T05:00:00.000Z',
      },
      idempotencyKey: KEY,
    });
    const body = lastInit(vi.mocked(api.post))?.body ?? {};
    expect(body).toMatchObject({
      patient_offering_id: PACKAGE_ID,
      appointment_id: 'apt_visit000000000000000',
      performed_at: '2026-10-10T05:00:00.000Z',
    });
    expect(body).not.toHaveProperty('session_number');
    expect(body).not.toHaveProperty('offering_id');
  });
});

describe('updateTreatment', () => {
  it('saves every field with the read’s updated_at', async () => {
    const session = await readSession({ patient_offering_id: null });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: treatmentRow() } as never);
    await updateTreatment({ treatment: session, fields: FIELDS, idempotencyKey: KEY });
    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/treatments/{patient_treatment_id}',
      {
        params: { patient_id: PATIENT_ID, patient_treatment_id: TREATMENT_ID },
        body: expect.objectContaining({
          offering_id: 'off_lhr00000000000000000',
          session_number: 3,
          expected_updated_at: '2026-10-10T01:41:12.606Z',
        }),
        idempotencyKey: KEY,
      },
    );
  });

  it('keeps a package session’s number and offering out of the change', async () => {
    const session = await readSession();
    vi.mocked(api.patch).mockResolvedValueOnce({ data: treatmentRow() } as never);
    await updateTreatment({ treatment: session, fields: FIELDS, idempotencyKey: KEY });
    const body = lastInit(vi.mocked(api.patch))?.body ?? {};
    expect(body).not.toHaveProperty('session_number');
    expect(body).not.toHaveProperty('offering_id');
    expect(body).toMatchObject({ name: 'LHR Full Face', remark: null });
  });
});

describe('reverseTreatment', () => {
  it('reverses a session with its reason and the action’s key', async () => {
    const session = await readSession();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: treatmentRow({ status: 'reversed', reversed_reason: 'Wrong patient' }),
    } as never);
    const reversed = await reverseTreatment({
      treatment: session,
      reason: 'Wrong patient',
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/treatments/{patient_treatment_id}/reverse',
      {
        params: { patient_id: PATIENT_ID, patient_treatment_id: TREATMENT_ID },
        body: { reason: 'Wrong patient' },
        idempotencyKey: KEY,
      },
    );
    expect(reversed).toMatchObject({
      status: 'reversed',
      reversedReason: 'Wrong patient',
    });
  });
});
