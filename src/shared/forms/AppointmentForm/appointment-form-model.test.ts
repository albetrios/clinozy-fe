import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
  contactHit,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';

import {
  applyAppointmentChange,
  type AppointmentDraft,
  copiesAsIs,
  copyDraftOf,
  createInputOf,
  detailsDone,
  draftComplete,
  draftOf,
  emptyDraft,
  hourLabel,
  isDraftDirty,
  leadBookingPrefill,
  moveRouteOf,
  movesAtCheckIn,
  newContactPhone,
  newDraftOf,
  patchOf,
  rebaseDraft,
  rescheduleDraftOf,
  rescheduleNote,
  savedDraftOf,
  saveLabelKind,
  slotColumns,
  slotDone,
  slotHours,
  slotMoved,
  snapLength,
  startingDoctorId,
  type WhoDraft,
  whoOfContact,
} from './appointment-form-model.ts';

const TODAY = APPOINTMENT_TODAY;

/** Riya's Peel tomorrow at 11:00, Confirmed — the Edit tests' booking. */
const peel = appointmentRow({
  type: 'treatment',
  serviceLabel: 'Peel',
  durationMin: 30,
  startTime: '11:00',
  endTime: '11:30',
  status: 'confirmed',
  reason: 'Acne scars',
});

/** Riya as the form holds her — a lead, her contact found by the search. */
const RIYA: WhoDraft = whoOfContact(contactHit());

const booked = (draft: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  ...emptyDraft(TODAY),
  who: RIYA,
  doctorId: DOCTOR_NISHA.id,
  time: '11:00',
  ...draft,
});

describe('who the booking is for', () => {
  it('holds a contact the search found: a lead while they have an open one', () => {
    expect(RIYA).toEqual({
      kind: 'lead',
      contactId: 'con_riya00000000000000000',
      name: 'Riya Mehta',
      phone: '+919825011241',
      patientId: null,
      leadId: 'lead_riya00000000000000000',
      contactNumber: 1201,
    });
  });

  it('holds a contact with a patient file as a patient, and one with neither as a contact', () => {
    expect(
      whoOfContact(contactHit({ patientId: 'pat_riya00000000000000000' })),
    ).toMatchObject({ kind: 'patient', patientId: 'pat_riya00000000000000000' });
    expect(whoOfContact(contactHit({ openLeadId: null }))).toMatchObject({
      kind: 'contact',
      leadId: null,
    });
  });
});

describe('starting a draft', () => {
  it('starts a New form on its day as a 20-minute Consultation, no one picked', () => {
    expect(emptyDraft('2026-10-05')).toEqual({
      who: null,
      newPhone: '',
      type: 'consultation',
      serviceLabel: 'Consultation',
      offeringId: null,
      doctorId: null,
      durationMin: 20,
      reason: '',
      notes: '',
      date: '2026-10-05',
      time: null,
      status: 'scheduled',
    });
  });

  it('reads a booking back for Edit: its person, service, doctor, slot and status', () => {
    expect(draftOf(peel)).toMatchObject({
      who: {
        kind: 'lead',
        contactId: peel.contactId,
        name: 'Riya Mehta',
        leadId: peel.leadId,
        contactNumber: 1201,
      },
      type: 'treatment',
      serviceLabel: 'Peel',
      doctorId: DOCTOR_NISHA.id,
      durationMin: 30,
      reason: 'Acne scars',
      notes: '',
      date: APPOINTMENT_TOMORROW,
      time: '11:00',
      status: 'confirmed',
    });
    expect(savedDraftOf(peel, 'edit', TODAY)).toEqual(draftOf(peel));
  });

  it('reschedules from the booking’s day, or from today once it has passed', () => {
    expect(rescheduleDraftOf(peel, TODAY).date).toBe(APPOINTMENT_TOMORROW);
    expect(rescheduleDraftOf(peel, '2026-12-01').date).toBe('2026-12-01');
    expect(savedDraftOf(peel, 'reschedule', '2026-12-01').date).toBe('2026-12-01');
  });

  it('copies a booking — same person, service, doctor, length and reason — today, no time', () => {
    expect(copyDraftOf(peel, TODAY)).toEqual({
      ...draftOf(peel),
      date: TODAY,
      time: null,
      status: 'scheduled',
    });
  });

  it('starts a New form from its prefill: the person, the day, the slot, the type, the reason', () => {
    const draft = newDraftOf(
      {
        date: '2026-10-05',
        time: '10:15',
        type: 'treatment',
        serviceLabel: 'LHR Treatment',
        durationMin: 35,
        reason: 'Upper lip and chin',
      },
      { person: RIYA, source: undefined, today: TODAY, doctorId: DOCTOR_ARJUN.id },
    );
    expect(draft).toMatchObject({
      who: RIYA,
      type: 'treatment',
      serviceLabel: 'LHR Treatment',
      durationMin: 30,
      reason: 'Upper lip and chin',
      doctorId: DOCTOR_ARJUN.id,
      date: '2026-10-05',
      time: '10:15',
    });
  });

  it('starts a past prefill day today, without its time, and a Copy from its booking', () => {
    const past = newDraftOf(
      { date: '2026-09-01', time: '10:15' },
      { person: undefined, source: undefined, today: TODAY, doctorId: null },
    );
    expect(past).toMatchObject({ date: TODAY, time: null, who: null });
    const copy = newDraftOf(
      { date: '2026-10-09', time: '12:00' },
      { person: undefined, source: peel, today: TODAY, doctorId: DOCTOR_ARJUN.id },
    );
    expect(copy).toEqual(copyDraftOf(peel, TODAY));
  });

  it('takes the first doctor known: the prefill’s, the copy’s, the first of the team', () => {
    expect(startingDoctorId([undefined, null, DOCTOR_NISHA.id, DOCTOR_ARJUN.id])).toBe(
      DOCTOR_NISHA.id,
    );
    expect(startingDoctorId([DOCTOR_ARJUN.id, DOCTOR_NISHA.id])).toBe(DOCTOR_ARJUN.id);
    expect(startingDoctorId([undefined, null])).toBeNull();
  });

  it('books from the lead drawer: the lead’s contact, LHR Treatment for a laser interest (§6.3)', () => {
    expect(
      leadBookingPrefill(
        { contactId: 'con_riya00000000000000000', interests: ['Laser hair'] },
        'x'.repeat(120),
      ),
    ).toEqual({
      whoId: 'con_riya00000000000000000',
      collapsed: true,
      lockedWho: true,
      type: 'treatment',
      serviceLabel: 'LHR Treatment',
      durationMin: 20,
      reason: 'x'.repeat(80),
    });
    expect(
      leadBookingPrefill(
        { contactId: 'con_dev000000000000000000', interests: ['Peel'] },
        null,
      ),
    ).toEqual({
      whoId: 'con_dev000000000000000000',
      collapsed: true,
      lockedWho: true,
      type: 'consultation',
      durationMin: 20,
    });
  });
});

describe('each control’s change (updA, H:5976)', () => {
  it('snaps a length to the nearest chip', () => {
    expect(snapLength(35)).toBe(30);
    expect(snapLength(50)).toBe(45);
    expect(snapLength(200)).toBe(120);
  });

  it('a new person clears a new contact’s mobile; the mobile keeps ten digits', () => {
    const draft = applyAppointmentChange(booked({ newPhone: '98' }), {
      kind: 'who',
      who: null,
    });
    expect(draft).toMatchObject({ who: null, newPhone: '' });
    expect(
      applyAppointmentChange(draft, { kind: 'newPhone', digits: '+91 98765-43210 99' })
        .newPhone,
    ).toBe('9198765432');
  });

  it('a type sets its service and length; Treatment keeps a treatment already picked', () => {
    const treatment = applyAppointmentChange(booked(), {
      kind: 'type',
      type: 'treatment',
    });
    expect(treatment).toMatchObject({
      serviceLabel: 'Treatment',
      offeringId: null,
      durationMin: 60,
    });
    const hydra = applyAppointmentChange(treatment, {
      kind: 'treatment',
      label: 'Hydrafacial',
      offeringId: 'off_hydra000000000000000',
      minutes: 50,
    });
    expect(hydra).toMatchObject({
      type: 'treatment',
      serviceLabel: 'Hydrafacial',
      offeringId: 'off_hydra000000000000000',
      durationMin: 45,
    });
    expect(applyAppointmentChange(hydra, { kind: 'type', type: 'treatment' })).toBe(
      hydra,
    );
    expect(
      applyAppointmentChange(hydra, { kind: 'type', type: 'follow_up' }),
    ).toMatchObject({ serviceLabel: 'Follow-up', offeringId: null, durationMin: 15 });
    const custom = { ...booked(), serviceLabel: 'Microneedling', type: 'other' as const };
    expect(
      applyAppointmentChange(custom, { kind: 'type', type: 'treatment' }),
    ).toMatchObject({ type: 'treatment', serviceLabel: 'Microneedling' });
  });

  it('a Package session takes its own service and keeps the length', () => {
    const hydra = applyAppointmentChange(booked(), {
      kind: 'treatment',
      label: 'Hydrafacial',
      offeringId: 'off_hydra000000000000000',
      minutes: 45,
    });
    expect(
      applyAppointmentChange(hydra, { kind: 'type', type: 'package_session' }),
    ).toMatchObject({
      type: 'package_session',
      serviceLabel: 'Package session',
      offeringId: null,
      durationMin: 45,
    });
  });

  it('a new doctor or day clears the time; the same one keeps the draft', () => {
    const draft = booked();
    expect(
      applyAppointmentChange(draft, { kind: 'doctor', doctorId: DOCTOR_ARJUN.id }),
    ).toMatchObject({ doctorId: DOCTOR_ARJUN.id, time: null });
    expect(
      applyAppointmentChange(draft, { kind: 'doctor', doctorId: DOCTOR_NISHA.id }),
    ).toBe(draft);
    expect(
      applyAppointmentChange(draft, { kind: 'date', date: APPOINTMENT_TOMORROW }),
    ).toMatchObject({ date: APPOINTMENT_TOMORROW, time: null });
    expect(applyAppointmentChange(draft, { kind: 'date', date: TODAY })).toBe(draft);
  });

  it('caps Reason and Notes, sets the length, the status and resets', () => {
    const draft = booked();
    expect(
      applyAppointmentChange(draft, { kind: 'reason', text: 'r'.repeat(200) }).reason,
    ).toHaveLength(120);
    expect(
      applyAppointmentChange(draft, { kind: 'notes', text: 'n'.repeat(300) }).notes,
    ).toHaveLength(200);
    expect(
      applyAppointmentChange(draft, { kind: 'length', minutes: 100 }).durationMin,
    ).toBe(90);
    expect(
      applyAppointmentChange(draft, { kind: 'status', status: 'confirmed' }).status,
    ).toBe('confirmed');
    const other = emptyDraft(null);
    expect(applyAppointmentChange(draft, { kind: 'reset', draft: other })).toBe(other);
  });

  it('a move in Edit returns a Confirmed booking to Scheduled; the saved slot restores it', () => {
    const saved = { date: peel.date, time: '11:00', status: 'confirmed' as const };
    const start = draftOf(peel);
    const moved = applyAppointmentChange(start, { kind: 'time', time: '12:00', saved });
    expect(moved).toMatchObject({ time: '12:00', status: 'scheduled' });
    expect(
      applyAppointmentChange(moved, { kind: 'time', time: '11:00', saved }).status,
    ).toBe('confirmed');
    const checkedIn = { ...saved, status: 'checked_in' as const };
    expect(
      applyAppointmentChange(
        { ...start, status: 'checked_in' },
        { kind: 'time', time: '12:00', saved: checkedIn },
      ).status,
    ).toBe('checked_in');
    expect(
      applyAppointmentChange(start, { kind: 'time', time: '12:00', saved: null }).time,
    ).toBe('12:00');
  });
});

describe('what the form derives', () => {
  const saved = { date: TODAY, time: '11:00', status: 'confirmed' as const };

  it('notes a move, and asks to confirm again when it was Confirmed (H:4142)', () => {
    expect(slotMoved(booked(), saved)).toBe(false);
    expect(slotMoved(booked({ time: '12:00' }), saved)).toBe(true);
    expect(slotMoved(booked({ time: null }), saved)).toBe(false);
    expect(rescheduleNote(booked({ time: '12:00' }), saved)).toEqual({
      was: saved,
      confirmAgain: true,
    });
    expect(
      rescheduleNote(booked({ time: '12:00' }), { ...saved, status: 'scheduled' }),
    ).toMatchObject({ confirmAgain: false });
    expect(
      rescheduleNote(booked({ time: '12:00' }), { ...saved, status: 'checked_in' }),
    ).toBeNull();
    expect(rescheduleNote(booked(), null)).toBeNull();
  });

  it('is dirty once a value differs from where it started — trimmed text aside', () => {
    const start = booked();
    expect(isDraftDirty({ ...start, reason: '   ' }, start)).toBe(false);
    expect(isDraftDirty({ ...start, reason: 'Acne' }, start)).toBe(true);
    expect(isDraftDirty({ ...start, who: null }, start)).toBe(true);
    expect(
      isDraftDirty(
        { ...start, who: { ...RIYA, contactId: 'con_other000000000000000' } },
        start,
      ),
    ).toBe(true);
  });

  it('rebases onto the booking’s new values, keeping every edit', () => {
    const previous = draftOf(peel);
    const edited = { ...previous, reason: 'Cheeks', doctorId: DOCTOR_ARJUN.id };
    const next = { ...previous, status: 'checked_in' as const, notes: 'Arrived early' };
    expect(rebaseDraft(edited, previous, next)).toMatchObject({
      reason: 'Cheeks',
      doctorId: DOCTOR_ARJUN.id,
      status: 'checked_in',
      notes: 'Arrived early',
    });
  });

  it('marks the steps done and the primary’s label (H:5983)', () => {
    expect(detailsDone(booked())).toBe(true);
    expect(detailsDone(booked({ doctorId: null }))).toBe(false);
    expect(slotDone(booked())).toBe(true);
    expect(draftComplete(booked({ who: null }))).toBe(false);
    expect(saveLabelKind('create', booked({ time: null }), null)).toBe('pickTime');
    expect(saveLabelKind('create', booked(), null)).toBe('book');
    expect(saveLabelKind('reschedule', booked(), saved)).toBe('move');
    expect(saveLabelKind('edit', booked(), saved)).toBe('saveChanges');
    expect(saveLabelKind('edit', booked({ time: '12:00' }), saved)).toBe('move');
  });

  it('says the person’s open lead moves to Clinic visited at check-in, until they are checked in', () => {
    expect(movesAtCheckIn('lead_riya00000000000000000', 'scheduled')).toBe(true);
    expect(movesAtCheckIn('lead_riya00000000000000000', 'confirmed')).toBe(true);
    expect(movesAtCheckIn('lead_riya00000000000000000', 'checked_in')).toBe(false);
    expect(movesAtCheckIn('lead_riya00000000000000000', 'completed')).toBe(false);
    expect(movesAtCheckIn(null, 'scheduled')).toBe(false);
  });
});

describe('the slot grid (H:6001–6002)', () => {
  const slot = (time: string, endTime: string) => ({ time, endTime });

  it('groups the free starts by hour, in order — no row for an hour without one', () => {
    const hours = slotHours([
      slot('09:00', '09:20'),
      slot('09:30', '09:50'),
      slot('11:00', '11:20'),
    ]);
    expect(hours).toEqual([
      { hour: 9, slots: [slot('09:00', '09:20'), slot('09:30', '09:50')] },
      { hour: 11, slots: [slot('11:00', '11:20')] },
    ]);
    expect(slotHours([])).toEqual([]);
  });

  it('splits more than six hours into two columns, the first holding the extra one', () => {
    const hours = Array.from({ length: 7 }, (_, index) => ({
      hour: 9 + index,
      slots: [],
    }));
    expect(slotColumns(hours).map((column) => column.length)).toEqual([4, 3]);
    expect(slotColumns(hours.slice(0, 6))).toHaveLength(1);
  });

  it('labels an hour on the 12-hour clock', () => {
    expect(hourLabel(0)).toEqual({ number: 12, period: 'am' });
    expect(hourLabel(12)).toEqual({ number: 12, period: 'pm' });
    expect(hourLabel(17)).toEqual({ number: 5, period: 'pm' });
  });
});

describe('what a save sends', () => {
  it('reads a new contact’s mobile as E.164 once it has ten digits', () => {
    const fresh = booked({
      who: { ...RIYA, kind: 'new', contactId: null, leadId: null, contactNumber: null },
      newPhone: '9876543210',
    });
    expect(newContactPhone(fresh)).toBe('+919876543210');
    expect(newContactPhone({ ...fresh, newPhone: '98765' })).toBeNull();
  });

  it('books the draft for a contact on a branch, its text trimmed', () => {
    const draft = booked({ reason: '  Acne  ', notes: '   ' });
    expect(
      createInputOf(draft, {
        branchId: TEST_BRANCH_ID,
        contactId: 'con_riya00000000000000000',
      }),
    ).toEqual({
      contactId: 'con_riya00000000000000000',
      branchId: TEST_BRANCH_ID,
      doctorId: DOCTOR_NISHA.id,
      type: 'consultation',
      serviceLabel: 'Consultation',
      offeringId: null,
      durationMin: 20,
      date: TODAY,
      startTime: '11:00',
      reason: 'Acne',
      notes: null,
    });
  });

  it('copies as is only for the same doctor, branch, service, length and reason — and no notes', () => {
    const copy = { ...copyDraftOf(peel, TODAY), time: '12:00' };
    expect(copiesAsIs(copy, peel, TEST_BRANCH_ID)).toBe(true);
    expect(copiesAsIs(copy, peel, 'brn_other000000000000000')).toBe(false);
    expect(copiesAsIs({ ...copy, doctorId: DOCTOR_ARJUN.id }, peel, TEST_BRANCH_ID)).toBe(
      false,
    );
    expect(copiesAsIs({ ...copy, durationMin: 45 }, peel, TEST_BRANCH_ID)).toBe(false);
    expect(copiesAsIs({ ...copy, reason: 'Cheeks' }, peel, TEST_BRANCH_ID)).toBe(false);
    expect(copiesAsIs({ ...copy, notes: 'Bring the report' }, peel, TEST_BRANCH_ID)).toBe(
      false,
    );
  });

  it('sends only what changed in Edit — the doctor, the day and the start among them', () => {
    const start = draftOf(peel);
    expect(patchOf(start, peel)).toEqual({});
    expect(
      patchOf(
        {
          ...start,
          reason: 'Cheeks',
          notes: ' Bring the report ',
          doctorId: DOCTOR_ARJUN.id,
          date: '2026-10-06',
          time: '12:00',
          status: 'scheduled',
        },
        peel,
      ),
    ).toEqual({
      reason: 'Cheeks',
      notes: 'Bring the report',
      doctorId: DOCTOR_ARJUN.id,
      date: '2026-10-06',
      startTime: '12:00',
    });
    expect(patchOf({ ...start, reason: '' }, peel)).toEqual({ reason: null });
  });

  it('asks the route for a status tile: confirm, check-in, complete — none for the rest', () => {
    const scheduled = appointmentRow();
    const checkedIn = appointmentRow({ status: 'checked_in' });
    expect(moveRouteOf(draftOf(scheduled), scheduled)).toBeNull();
    expect(moveRouteOf({ ...draftOf(scheduled), status: 'confirmed' }, scheduled)).toBe(
      'confirm',
    );
    expect(moveRouteOf({ ...draftOf(scheduled), status: 'checked_in' }, scheduled)).toBe(
      'check-in',
    );
    expect(moveRouteOf({ ...draftOf(peel), status: 'checked_in' }, peel)).toBe(
      'check-in',
    );
    expect(moveRouteOf({ ...draftOf(checkedIn), status: 'completed' }, checkedIn)).toBe(
      'complete',
    );
    // A move of the slot set a Confirmed booking back to Scheduled — the server does that itself.
    expect(moveRouteOf({ ...draftOf(peel), status: 'scheduled' }, peel)).toBeNull();
  });
});
