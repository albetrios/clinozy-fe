import { describe, expect, it } from 'vitest';

import {
  type FloorAppointmentWire,
  floorAppointmentWire,
  type FloorLookups,
  todayLaneOf,
  toTodayEnquiry,
  toTodayFloorRow,
  toTodayPrescription,
} from './today-contracts.ts';

/** A floor appointment as `GET /app/appointments` sends it (the parts the floor reads, and more). */
const wire = (patch: Partial<FloorAppointmentWire> = {}) =>
  floorAppointmentWire.parse({
    id: 'appt_000000000000000000001',
    appointment_number: 2847,
    contact_id: 'con_000000000000000000001',
    contact: {
      id: 'con_000000000000000000001',
      contact_number: 12001,
      first_name: 'Meera',
      last_name: 'Joshi',
      primary_phone: '+919824055123',
    },
    patient_id: 'pat_000000000000000000002',
    lead_id: null,
    branch_id: 'brn_000000000000000000003',
    type: 'treatment',
    offering_id: null,
    service_label: 'Hydrafacial',
    doctor_membership_id: 'mem_000000000000000000004',
    therapist_membership_id: null,
    branch_room_id: 'room_00000000000000000005',
    appointment_date: '2026-10-03',
    start_time: '11:00',
    end_time: '11:45',
    duration_minutes: 45,
    status: 'checked_in',
    visit_stage: 'pharmacy',
    visit_stage_changed_at: '2026-10-03T05:00:00.000Z',
    visit_paused_at: null,
    is_walk_in: false,
    checked_in_at: '2026-10-03T04:30:00.000Z',
    updated_at: '2026-10-03T05:00:00.000Z',
    ...patch,
  });

const lookups: FloorLookups = {
  doctorNames: new Map([['mem_000000000000000000004', 'Dr. Nisha Mavani']]),
  roomNames: new Map([['room_00000000000000000005', 'Room 2']]),
  prescriptions: new Map([
    [
      'appt_000000000000000000001',
      {
        id: 'rx_0000000000000000000001',
        patientId: 'pat_000000000000000000002',
        approvedAt: '2026-10-03T04:55:00.000Z',
        items: 3,
      },
    ],
  ]),
};

describe('toTodayFloorRow', () => {
  it('reads the contact, the doctor’s and room’s names and the Rx a pharmacy card dispenses', () => {
    expect(toTodayFloorRow(wire(), lookups)).toEqual({
      id: 'appt_000000000000000000001',
      appointmentNumber: 2847,
      contactId: 'con_000000000000000000001',
      name: 'Meera Joshi',
      phone: '+919824055123',
      patientId: 'pat_000000000000000000002',
      leadId: null,
      branchId: 'brn_000000000000000000003',
      type: 'treatment',
      serviceLabel: 'Hydrafacial',
      doctorMembershipId: 'mem_000000000000000000004',
      doctorName: 'Dr. Nisha Mavani',
      roomName: 'Room 2',
      startTime: '11:00',
      status: 'checked_in',
      visitStage: 'pharmacy',
      visitStageChangedAt: '2026-10-03T05:00:00.000Z',
      checkedInAt: '2026-10-03T04:30:00.000Z',
      isWalkIn: false,
      updatedAt: '2026-10-03T05:00:00.000Z',
      prescription: lookups.prescriptions.get('appt_000000000000000000001'),
    });
  });

  it('carries an Rx only at the pharmacy, and no names it cannot find', () => {
    const row = toTodayFloorRow(
      wire({
        visit_stage: 'checkout',
        branch_room_id: null,
        doctor_membership_id: 'mem_x',
      }),
      lookups,
    );
    expect(row.prescription).toBeNull();
    expect(row.roomName).toBeNull();
    expect(row.doctorName).toBeNull();
  });

  it('refuses a status that is not on the floor', () => {
    expect(() => wire({ status: 'completed' as never })).toThrow();
  });
});

describe('toTodayEnquiry and toTodayPrescription', () => {
  it('reads an enquiry; one with no activity yet is not on the lane', () => {
    const row = {
      id: 'lead_00000000000000000050',
      lead_number: 2363,
      contact: { first_name: 'Anaya', last_name: 'Desai' },
      status: 'new' as const,
      source: 'whatsapp' as const,
      interests: ['clinical' as const],
      last_activity_at: '2026-10-03T05:01:00.000Z',
    };
    expect(toTodayEnquiry(row)).toEqual({
      id: 'lead_00000000000000000050',
      leadNumber: 2363,
      name: 'Anaya Desai',
      status: 'new',
      source: 'whatsapp',
      interests: ['clinical'],
      lastActivityAt: '2026-10-03T05:01:00.000Z',
    });
    expect(toTodayEnquiry({ ...row, last_activity_at: null })).toBeNull();
  });

  it('counts an approved Rx’s medicines; a draft is none', () => {
    const row = {
      id: 'rx_1',
      patient_id: 'pat_1',
      appointment_id: 'appt_1',
      items: [{ medicine_name: 'A' }, { medicine_name: 'B' }],
      approved_at: '2026-10-03T04:55:00.000Z',
    };
    expect(toTodayPrescription(row)).toEqual({
      id: 'rx_1',
      patientId: 'pat_1',
      approvedAt: '2026-10-03T04:55:00.000Z',
      items: 2,
    });
    expect(toTodayPrescription({ ...row, approved_at: null })).toBeNull();
  });
});

describe('todayLaneOf', () => {
  it('puts a booking not yet checked in in Arriving', () => {
    expect(todayLaneOf({ status: 'scheduled', visitStage: null })).toBe('arriving');
    expect(todayLaneOf({ status: 'confirmed', visitStage: null })).toBe('arriving');
  });

  it('puts a checked-in booking in its stage — Waiting before the first move', () => {
    expect(todayLaneOf({ status: 'checked_in', visitStage: null })).toBe('waiting');
    for (const stage of [
      'waiting',
      'with_doctor',
      'treatment',
      'checkout',
      'pharmacy',
    ] as const) {
      expect(todayLaneOf({ status: 'checked_in', visitStage: stage })).toBe(stage);
    }
  });
});
