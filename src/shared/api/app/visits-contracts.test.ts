import { describe, expect, it } from 'vitest';

import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';

import type { ClinicalNote } from './clinical-notes-contracts.ts';
import {
  isSessionDue,
  stageAfter,
  stageAfterRecord,
  toVisitRecord,
  VISIT_STAGES,
  visitChecksOf,
  visitWire,
} from './visits-contracts.ts';

/** A safety-check note at the visit. */
const note = (id: string, text: string, kind: ClinicalNote['kind'] = 'safety_check') => ({
  id,
  patientId: 'pat_priya0000000000000000',
  kind,
  text,
  appointmentId: 'appt_priya000000000000000',
  diagnosisId: null,
  addedAt: '2026-10-03T05:00:00.000Z',
});

/** A visit at a stage, for a booking of a type. */
const visitAt = (
  stage: (typeof VISIT_STAGES)[number],
  type: ReturnType<typeof appointmentRow>['type'] = 'consultation',
) => ({ stage, booking: appointmentRow({ type }) });

describe('stageAfter — the stage moves forward only', () => {
  it('is the target when it is later, in the API’s order', () => {
    expect(VISIT_STAGES).toEqual([
      'waiting',
      'with_doctor',
      'treatment',
      'checkout',
      'pharmacy',
    ]);
    expect(stageAfter('waiting', 'treatment')).toBe('treatment');
    expect(stageAfter('with_doctor', 'checkout')).toBe('checkout');
  });

  it('is null for the same stage or an earlier one — the API would refuse it', () => {
    expect(stageAfter('checkout', 'checkout')).toBeNull();
    expect(stageAfter('pharmacy', 'checkout')).toBeNull();
    expect(stageAfter('treatment', 'with_doctor')).toBeNull();
  });
});

describe('visitWire / toVisitRecord', () => {
  it('reads a checked-in booking: the booking, its stage, since when, and its pause', () => {
    const row = {
      id: 'appt_priya000000000000000',
      appointment_number: 2870,
      contact_id: 'con_priya0000000000000000',
      contact: {
        contact_number: 1188,
        first_name: 'Priya',
        last_name: 'Shah',
        primary_phone: '+919876543210',
      },
      patient_id: 'pat_priya0000000000000000',
      lead_id: null,
      branch_id: 'brn_main0000000000000000',
      type: 'treatment',
      offering_id: null,
      service_label: 'LHR Full Face',
      doctor_membership_id: 'mem_nisha0000000000000000',
      therapist_membership_id: null,
      branch_room_id: null,
      branch_machine_id: null,
      appointment_date: '2026-10-03',
      start_time: '10:30',
      end_time: '11:30',
      duration_minutes: 60,
      status: 'checked_in',
      cancel_reason: null,
      cancel_note: null,
      rescheduled_from: null,
      reason: null,
      notes: null,
      follow_up_at: null,
      checked_in_at: '2026-10-03T05:00:00.000Z',
      completed_at: null,
      copied_from_appointment_id: null,
      reminder_status: 'not_sent',
      is_confirmed_by_reply: false,
      move_count: 0,
      visit_stage: 'with_doctor',
      visit_stage_changed_at: '2026-10-03T05:10:00.000Z',
      visit_paused_at: null,
      is_walk_in: false,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-03T05:10:00.000Z',
    };
    const visit = toVisitRecord(visitWire.parse(row));
    expect(visit).toMatchObject({
      appointmentId: 'appt_priya000000000000000',
      stage: 'with_doctor',
      stageAt: '2026-10-03T05:10:00.000Z',
      pausedAt: null,
    });
    expect(visit.booking).toMatchObject({
      seq: 2870,
      patientId: 'pat_priya0000000000000000',
      type: 'treatment',
      doctorId: 'mem_nisha0000000000000000',
      status: 'checked_in',
    });
    expect(() => visitWire.parse({ ...row, visit_stage: null })).toThrow();
  });
});

describe('visitChecksOf — the checks the visit’s safety-check notes record', () => {
  it('finds each check by its note’s text, and leaves the others undone', () => {
    const consent = note('pcn_consent', 'Consent signed');
    const allergies = note('pcn_allergy', 'Allergies & medicines checked');
    expect(
      visitChecksOf([consent, note('pcn_other', 'No isotretinoin'), allergies]),
    ).toEqual({ consent, photos: null, allergies });
  });

  it('counts only safety-check notes', () => {
    expect(
      visitChecksOf([note('pcn_x', 'Consent signed', 'finding')]).consent,
    ).toBeNull();
  });
});

describe('isSessionDue — a visit with a pending session (today.md:160)', () => {
  const none: [] = [];
  const pack = [{ status: 'active' as const, sessionsLeft: 3 }];

  it('is due for a treatment or a package-session booking before Checkout', () => {
    for (const type of ['treatment', 'package_session'] as const) {
      expect(
        isSessionDue({
          visit: visitAt('with_doctor', type),
          sessionRecorded: false,
          packages: none,
        }),
      ).toBe(true);
    }
  });

  it('is due for a follow-up while a package can still spend one — never for a consultation', () => {
    const facts = { sessionRecorded: false, packages: pack };
    expect(isSessionDue({ ...facts, visit: visitAt('waiting', 'follow_up') })).toBe(true);
    expect(isSessionDue({ ...facts, visit: visitAt('waiting', 'consultation') })).toBe(
      false,
    );
    expect(
      isSessionDue({
        visit: visitAt('waiting', 'follow_up'),
        sessionRecorded: false,
        packages: [{ status: 'used_up', sessionsLeft: 0 }],
      }),
    ).toBe(false);
  });

  it('is not due once a session is recorded, or from Checkout on', () => {
    expect(
      isSessionDue({
        visit: visitAt('with_doctor', 'treatment'),
        sessionRecorded: true,
        packages: none,
      }),
    ).toBe(false);
    expect(
      isSessionDue({
        visit: visitAt('checkout', 'treatment'),
        sessionRecorded: false,
        packages: none,
      }),
    ).toBe(false);
  });
});

describe('stageAfterRecord — the stage after a record (Q8)', () => {
  it('takes an Rx to Treatment while a session is due, else to Checkout', () => {
    expect(
      stageAfterRecord('prescription', {
        visit: { stage: 'with_doctor' },
        sessionDue: true,
      }),
    ).toBe('treatment');
    expect(
      stageAfterRecord('prescription', {
        visit: { stage: 'with_doctor' },
        sessionDue: false,
      }),
    ).toBe('checkout');
  });

  it('takes a session to Checkout, and never moves a visit back', () => {
    expect(
      stageAfterRecord('treatment', { visit: { stage: 'treatment' }, sessionDue: false }),
    ).toBe('checkout');
    expect(
      stageAfterRecord('prescription', {
        visit: { stage: 'checkout' },
        sessionDue: true,
      }),
    ).toBeNull();
    expect(
      stageAfterRecord('treatment', { visit: { stage: 'pharmacy' }, sessionDue: false }),
    ).toBeNull();
  });
});
