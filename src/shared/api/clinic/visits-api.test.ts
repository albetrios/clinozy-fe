import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('./appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  moveAppointment: vi.fn(async () => undefined),
}));
import { api } from '@/core/http/api.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';
import { TEST_CONTACT_ID, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { appointmentQueryKeys, moveAppointment } from './appointments-api.ts';
import { clinicalNoteQueryKeys } from './clinical-notes-api.ts';
import { patientFileQueryKeys } from './patient-file-api.ts';
import {
  fetchOpenVisit,
  fetchVisitCheckNotes,
  recordVisitCheck,
  removeVisitCheck,
  setVisitPaused,
  startVisit,
  VISIT_WRITE_KEYS,
  visitQueryKeys,
} from './visits-api.ts';

const APPOINTMENT_ID = 'appt_priya000000000000000';

/** Priya's booking as clinozy-be answers it — checked in today, with the doctor. */
const visitWireRow = (patch: Record<string, unknown> = {}) => ({
  id: APPOINTMENT_ID,
  appointment_number: 2870,
  contact_id: TEST_CONTACT_ID,
  contact: {
    contact_number: 1188,
    first_name: 'Priya',
    last_name: 'Shah',
    primary_phone: '+919876543210',
  },
  patient_id: TEST_PATIENT_ID,
  lead_id: null,
  branch_id: TEST_BRANCH_ID,
  type: 'consultation',
  offering_id: null,
  service_label: 'Consultation',
  doctor_membership_id: DOCTOR_NISHA.id,
  therapist_membership_id: null,
  branch_room_id: null,
  branch_machine_id: null,
  appointment_date: APPOINTMENT_TODAY,
  start_time: '09:00',
  end_time: '09:20',
  duration_minutes: 20,
  status: 'checked_in',
  cancel_reason: null,
  cancel_note: null,
  rescheduled_from: null,
  reason: null,
  notes: null,
  follow_up_at: null,
  checked_in_at: '2026-10-03T03:30:00.000Z',
  completed_at: null,
  copied_from_appointment_id: null,
  reminder_status: 'not_sent',
  is_confirmed_by_reply: false,
  move_count: 0,
  visit_stage: 'with_doctor',
  visit_stage_changed_at: '2026-10-03T03:35:00.000Z',
  visit_paused_at: null,
  is_walk_in: false,
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-03T03:35:00.000Z',
  ...patch,
});

/** A safety-check note as clinozy-be answers it. */
const noteWire = (id: string, text: string) => ({
  id,
  patient_id: TEST_PATIENT_ID,
  kind: 'safety_check',
  text,
  appointment_id: APPOINTMENT_ID,
  patient_diagnosis_id: null,
  added_at: '2026-10-03T05:00:00.000Z',
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
  vi.mocked(moveAppointment).mockClear();
});

describe('the visit query keys', () => {
  it('keeps the open visit under the appointments prefix — every booking write refreshes it', () => {
    expect(visitQueryKeys.open('org_test', TEST_CONTACT_ID).slice(0, 2)).toEqual([
      ...appointmentQueryKeys.all,
    ]);
    expect(visitQueryKeys.open('org_test', TEST_CONTACT_ID)).toEqual([
      'clinic',
      'appointments',
      'visits',
      'org_test',
      'open',
      TEST_CONTACT_ID,
    ]);
  });

  it('keeps the checks under the clinical notes’ prefix', () => {
    expect(
      visitQueryKeys.checks('org_test', TEST_PATIENT_ID, APPOINTMENT_ID).slice(0, 2),
    ).toEqual([...clinicalNoteQueryKeys.all]);
  });

  it('refreshes every booking read and the patient file after a write at a visit', () => {
    expect(VISIT_WRITE_KEYS).toEqual([
      appointmentQueryKeys.all,
      patientFileQueryKeys.all,
    ]);
  });
});

describe('fetchOpenVisit', () => {
  it('asks for the person’s booking checked in today and reads it as the visit', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [visitWireRow()] } as never);
    const visit = await fetchOpenVisit(TEST_CONTACT_ID);
    expect(api.get).toHaveBeenCalledWith('/app/appointments', {
      query: {
        contact_id: TEST_CONTACT_ID,
        appointment_date_from: APPOINTMENT_TODAY,
        appointment_date_to: APPOINTMENT_TODAY,
        status: 'checked_in',
      },
    });
    expect(visit).toMatchObject({
      appointmentId: APPOINTMENT_ID,
      stage: 'with_doctor',
      pausedAt: null,
      booking: { patientId: TEST_PATIENT_ID, contactId: TEST_CONTACT_ID },
    });
  });

  it('is null when nothing is checked in today', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never);
    expect(await fetchOpenVisit(TEST_CONTACT_ID)).toBeNull();
  });
});

describe('the safety checks', () => {
  const target = { patientId: TEST_PATIENT_ID, appointmentId: APPOINTMENT_ID };

  it('reads the visit’s safety-check notes', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [noteWire('pcn_consent', 'Consent signed')],
    } as never);
    const notes = await fetchVisitCheckNotes(target);
    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/clinical-notes', {
      params: { patient_id: TEST_PATIENT_ID },
      query: {
        kind: 'safety_check',
        appointment_id: APPOINTMENT_ID,
        sort: 'created_at',
        order: 'asc',
      },
    });
    expect(notes).toEqual([
      expect.objectContaining({
        id: 'pcn_consent',
        kind: 'safety_check',
        text: 'Consent signed',
        appointmentId: APPOINTMENT_ID,
      }),
    ]);
  });

  it('records a tick as a safety-check note at the visit, in the check’s words', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: noteWire('pcn_photos', 'Before photos taken'),
    } as never);
    const saved = await recordVisitCheck({
      ...target,
      check: 'photos',
      idempotencyKey: 'key-1',
    });
    expect(api.post).toHaveBeenCalledWith('/app/patients/{patient_id}/clinical-notes', {
      params: { patient_id: TEST_PATIENT_ID },
      body: {
        kind: 'safety_check',
        text: 'Before photos taken',
        appointment_id: APPOINTMENT_ID,
      },
      idempotencyKey: 'key-1',
    });
    expect(saved.id).toBe('pcn_photos');
  });

  it('removes an untick’s note with the reason `not_needed` (Q24)', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as never);
    await removeVisitCheck({ patientId: TEST_PATIENT_ID, noteId: 'pcn_photos' });
    expect(api.delete).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/clinical-notes/{patient_clinical_note_id}',
      {
        params: { patient_id: TEST_PATIENT_ID, patient_clinical_note_id: 'pcn_photos' },
        reason: 'not_needed',
      },
    );
  });
});

describe('startVisit — the open visit, else today’s booking checked in, else a walk-in', () => {
  const start = {
    contactId: TEST_CONTACT_ID,
    branchId: TEST_BRANCH_ID,
    doctorId: DOCTOR_NISHA.id,
    idempotencyKey: 'key-start',
  };
  /** The person's bookings today, by the statuses asked for. */
  const today = ({
    checkedIn = [],
    booked = [],
  }: {
    checkedIn?: unknown[];
    booked?: unknown[];
  }) =>
    vi.mocked(api.get).mockImplementation((async (
      _path: string,
      init: { query: { status: string } },
    ) => ({
      data: init.query.status === 'checked_in' ? checkedIn : booked,
    })) as never);

  it('leaves a visit already open as it is', async () => {
    today({ checkedIn: [visitWireRow()] });
    await startVisit(start);
    expect(moveAppointment).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('checks in the first booking of today still to come, with the action’s key', async () => {
    today({
      booked: [
        visitWireRow({
          id: 'appt_first00000000000000',
          status: 'confirmed',
          visit_stage: null,
        }),
        visitWireRow({
          id: 'appt_later00000000000000',
          status: 'scheduled',
          visit_stage: null,
        }),
      ],
    });
    await startVisit(start);
    expect(api.get).toHaveBeenLastCalledWith('/app/appointments', {
      query: expect.objectContaining({
        contact_id: TEST_CONTACT_ID,
        status: 'scheduled,confirmed',
      }),
    });
    expect(moveAppointment).toHaveBeenCalledWith({
      appointmentId: 'appt_first00000000000000',
      route: 'check-in',
      idempotencyKey: 'key-start',
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('books a walk-in — a consultation at the branch with the doctor, placed at now by the server', async () => {
    today({});
    vi.mocked(api.post).mockResolvedValue({
      data: visitWireRow({ is_walk_in: true }),
    } as never);
    await startVisit(start);
    expect(moveAppointment).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/app/appointments', {
      body: {
        contact_id: TEST_CONTACT_ID,
        branch_id: TEST_BRANCH_ID,
        doctor_membership_id: DOCTOR_NISHA.id,
        is_walk_in: true,
        type: 'consultation',
        service_label: 'Consultation',
        duration_minutes: 20,
      },
      idempotencyKey: 'key-start',
    });
  });
});

describe('setVisitPaused', () => {
  it('pauses a running visit and resumes a paused one, each its route', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: visitWireRow({ visit_paused_at: '2026-10-03T04:00:00.000Z' }),
    } as never);
    const paused = await setVisitPaused({
      appointmentId: APPOINTMENT_ID,
      paused: true,
      idempotencyKey: 'key-pause',
    });
    expect(api.post).toHaveBeenCalledWith('/app/appointments/{appointment_id}/pause', {
      params: { appointment_id: APPOINTMENT_ID },
      idempotencyKey: 'key-pause',
    });
    expect(paused.pausedAt).toBe('2026-10-03T04:00:00.000Z');

    vi.mocked(api.post).mockResolvedValue({ data: visitWireRow() } as never);
    await setVisitPaused({
      appointmentId: APPOINTMENT_ID,
      paused: false,
      idempotencyKey: 'key-resume',
    });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/appointments/{appointment_id}/resume',
      {
        params: { appointment_id: APPOINTMENT_ID },
        idempotencyKey: 'key-resume',
      },
    );
  });
});
