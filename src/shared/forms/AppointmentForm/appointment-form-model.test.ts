import { beforeAll, describe, expect, it, vi } from 'vitest';

import { fetchAppointment } from '@/shared/api/clinic/appointments-api.ts';
import type {
  AppointmentConnectedLead,
  AppointmentPackageOption,
  AppointmentRow,
  AppointmentSlot,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  applyAppointmentChange,
  type AppointmentDraft,
  copyDraftOf,
  createInputOf,
  detailsDone,
  draftComplete,
  draftOf,
  emptyDraft,
  hourLabel,
  isDraftDirty,
  isOpenLead,
  leadBookingPrefill,
  leadChoices,
  linkedLeadId,
  movesAtCheckIn,
  newContactPhone,
  newDraftOf,
  patchOf,
  planFlagOf,
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
  whoOf,
} from './appointment-form-model.ts';

const TODAY = '2026-10-03';

/** Dharti's Peel on 8 Oct, Confirmed — the Edit tests' booking. */
let peel: AppointmentRow;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
  resetClinicFixtures();
  peel = await fetchAppointment(ref.appointment(2859));
  vi.useRealTimers();
});

const PRIYA: WhoDraft = {
  kind: 'lead',
  name: 'Priya Shah',
  phone: '+919876543210',
  patientId: null,
  leadId: 'lead-1',
  seq: 2401,
};

const lead = (
  overrides: Partial<AppointmentConnectedLead>,
): AppointmentConnectedLead => ({
  id: 'lead-1',
  seq: 2401,
  status: 'new',
  kind: 'enquiry',
  source: 'instagram',
  interests: ['LHR'],
  ownerName: 'Reenal Shah',
  patientId: null,
  createdAt: '2026-09-30T10:00:00.000Z',
  ...overrides,
});

const PACKAGE: AppointmentPackageOption = {
  id: 'pack-1',
  offeringId: 'off-1',
  name: 'LHR Full Face · 6',
  tone: 'blush',
  durationMin: 50,
  sessionsTotal: 6,
  sessionsUsed: 2,
  validUntil: '2027-03-23',
};

const booked = (draft: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  ...emptyDraft(TODAY),
  who: PRIYA,
  doctorId: 'dr-1',
  time: '11:00',
  ...draft,
});

describe('starting a draft', () => {
  it('starts a New form on its day as a 20-minute Consultation', () => {
    expect(emptyDraft('2026-10-05')).toMatchObject({
      who: null,
      type: 'consultation',
      serviceLabel: 'Consultation',
      durationMin: 20,
      date: '2026-10-05',
      time: null,
      status: 'scheduled',
    });
  });

  it('reads a booking back for Edit, its person, service, slot and status', () => {
    expect(draftOf(peel)).toMatchObject({
      who: whoOf(peel.person),
      serviceLabel: 'Peel',
      durationMin: 30,
      date: peel.date,
      time: '11:00',
      status: 'confirmed',
    });
    expect(savedDraftOf(peel, 'edit', TODAY)).toEqual(draftOf(peel));
  });

  it('reschedules from the booking’s day, or from today once it has passed', () => {
    expect(rescheduleDraftOf(peel, TODAY).date).toBe(peel.date);
    expect(rescheduleDraftOf(peel, '2026-12-01').date).toBe('2026-12-01');
    expect(savedDraftOf(peel, 'reschedule', '2026-12-01').date).toBe('2026-12-01');
  });

  it('copies a booking — same person, service, doctor and length — today, no time (Q-A6)', () => {
    expect(copyDraftOf(peel, TODAY)).toMatchObject({
      who: whoOf(peel.person),
      serviceLabel: 'Peel',
      doctorId: peel.doctorId,
      durationMin: 30,
      date: TODAY,
      time: null,
      status: 'scheduled',
      packageId: null,
      leadPick: null,
    });
  });

  it('starts a New form from its prefill: the day, the slot, the type, the reason', () => {
    const draft = newDraftOf(
      {
        date: '2026-10-05',
        time: '10:15',
        type: 'treatment',
        serviceLabel: 'LHR Treatment',
        durationMin: 35,
        reason: 'Upper lip and chin',
      },
      { person: peel.person, source: undefined, today: TODAY, doctorId: 'dr-1' },
    );
    expect(draft).toMatchObject({
      who: whoOf(peel.person),
      type: 'treatment',
      serviceLabel: 'LHR Treatment',
      durationMin: 30,
      reason: 'Upper lip and chin',
      doctorId: 'dr-1',
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
      { person: undefined, source: peel, today: TODAY, doctorId: 'dr-9' },
    );
    expect(copy).toEqual(copyDraftOf(peel, TODAY));
  });

  it('takes the first doctor known: the prefill’s, the copy’s, the usual, the branch’s, the first', () => {
    expect(startingDoctorId([undefined, null, 'usual', 'branch'])).toBe('usual');
    expect(startingDoctorId(['prefill', 'usual'])).toBe('prefill');
    expect(startingDoctorId([undefined, null])).toBeNull();
  });

  it('books from the lead drawer: LHR Treatment for a laser interest, else Consultation (§6.3)', () => {
    expect(
      leadBookingPrefill({ id: 'l1', interests: ['Laser hair'] }, 'x'.repeat(120)),
    ).toEqual({
      whoId: 'l1',
      collapsed: true,
      type: 'treatment',
      serviceLabel: 'LHR Treatment',
      durationMin: 20,
      reason: 'x'.repeat(80),
    });
    expect(leadBookingPrefill({ id: 'l2', interests: ['Peel'] }, null)).toEqual({
      whoId: 'l2',
      collapsed: true,
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

  it('a new person clears the Lead pick and a new contact’s mobile', () => {
    const draft = applyAppointmentChange(booked({ leadPick: 'x', newPhone: '98' }), {
      kind: 'who',
      who: null,
    });
    expect(draft).toMatchObject({ who: null, leadPick: null, newPhone: '' });
    expect(
      applyAppointmentChange(draft, { kind: 'newPhone', digits: '+91 98765-43210 99' })
        .newPhone,
    ).toBe('9198765432');
    expect(applyAppointmentChange(draft, { kind: 'lead', leadId: 'l2' }).leadPick).toBe(
      'l2',
    );
  });

  it('a type sets its service and length; Treatment keeps a treatment already picked', () => {
    const treatment = applyAppointmentChange(booked(), {
      kind: 'type',
      type: 'treatment',
      packages: [],
    });
    expect(treatment).toMatchObject({ serviceLabel: 'Treatment', durationMin: 60 });
    const hydra = applyAppointmentChange(treatment, {
      kind: 'treatment',
      label: 'Hydrafacial',
      offeringId: 'off-h',
      minutes: 45,
    });
    const followUp = applyAppointmentChange(hydra, {
      kind: 'type',
      type: 'follow_up',
      packages: [],
    });
    expect(followUp).toMatchObject({ serviceLabel: 'Follow-up', durationMin: 15 });
    expect(
      applyAppointmentChange(hydra, { kind: 'type', type: 'treatment', packages: [] }),
    ).toBe(hydra);
    const custom = { ...booked(), serviceLabel: 'Microneedling', type: 'other' as const };
    expect(
      applyAppointmentChange(custom, { kind: 'type', type: 'treatment', packages: [] }),
    ).toMatchObject({ type: 'treatment', serviceLabel: 'Microneedling' });
  });

  it('a Package session takes the picked or the first package, its length snapped', () => {
    const pkg = applyAppointmentChange(booked(), {
      kind: 'type',
      type: 'package_session',
      packages: [PACKAGE],
    });
    expect(pkg).toMatchObject({
      type: 'package_session',
      packageId: 'pack-1',
      offeringId: 'off-1',
      serviceLabel: 'LHR Full Face · 6',
      durationMin: 45,
    });
    const none = applyAppointmentChange(booked({ durationMin: 30 }), {
      kind: 'type',
      type: 'package_session',
      packages: [],
    });
    expect(none).toMatchObject({ packageId: null, durationMin: 30 });
    expect(
      applyAppointmentChange(booked(), { kind: 'package', option: PACKAGE }).packageId,
    ).toBe('pack-1');
  });

  it('a new doctor or day clears the time; the same one keeps the draft', () => {
    const draft = booked();
    expect(
      applyAppointmentChange(draft, { kind: 'doctor', doctorId: 'dr-2' }).time,
    ).toBeNull();
    expect(applyAppointmentChange(draft, { kind: 'doctor', doctorId: 'dr-1' })).toBe(
      draft,
    );
    expect(
      applyAppointmentChange(draft, { kind: 'date', date: '2026-10-04' }).time,
    ).toBeNull();
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
        {
          kind: 'time',
          time: '12:00',
          saved: checkedIn,
        },
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
  });

  it('rebases onto the booking’s new values, keeping every edit', () => {
    const previous = draftOf(peel);
    const edited = { ...previous, reason: 'Cheeks', doctorId: 'dr-9' };
    const next = { ...previous, status: 'checked_in' as const, notes: 'Arrived early' };
    expect(rebaseDraft(edited, previous, next)).toMatchObject({
      reason: 'Cheeks',
      doctorId: 'dr-9',
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

  it('shows the plan flag in Edit for a patient from Confirmed on, counting this visit’s', () => {
    const visit = {
      edit: true,
      isPatient: true,
      status: 'confirmed' as const,
      appointmentId: 'a1',
    };
    const lines = [
      { status: 'planned', appointmentId: 'a1' },
      { status: 'accepted', appointmentId: 'a0' },
      { status: 'declined', appointmentId: 'a1' },
    ];
    expect(planFlagOf(visit, lines)).toEqual({ total: 2, forVisit: 1 });
    expect(planFlagOf(visit, undefined)).toEqual({ total: 0, forVisit: 0 });
    expect(planFlagOf({ ...visit, status: 'scheduled' }, lines)).toBeNull();
    expect(planFlagOf({ ...visit, isPatient: false }, lines)).toBeNull();
  });
});

describe('connected leads (S:330, H:4139)', () => {
  it('offers the open leads not on a patient record, and links the pick or the first', () => {
    const open = lead({ id: 'a' });
    const closed = lead({ id: 'b', status: 'lost' });
    const converted = lead({ id: 'c', patientId: 'p1' });
    const thread = lead({ id: 'd', status: null });
    expect(isOpenLead(open)).toBe(true);
    expect(isOpenLead(closed)).toBe(false);
    expect(isOpenLead(converted)).toBe(false);
    expect(leadChoices([open, closed, converted, thread]).map((row) => row.id)).toEqual([
      'a',
      'd',
    ]);
    const leads = [open, thread];
    expect(linkedLeadId(booked(), leads)).toBe('a');
    expect(linkedLeadId(booked({ leadPick: 'd' }), leads)).toBe('d');
    expect(linkedLeadId(booked({ leadPick: 'b' }), leads)).toBe('a');
    expect(linkedLeadId(booked(), [])).toBe('lead-1');
  });

  it('says a lead moves to Clinic visited at check-in only before check-in', () => {
    expect(movesAtCheckIn([lead({})], 'scheduled')).toBe(true);
    expect(movesAtCheckIn([lead({})], 'checked_in')).toBe(false);
    expect(movesAtCheckIn([lead({ status: 'clinic_visited' })], 'scheduled')).toBe(false);
  });
});

describe('the slot grid (H:6001–6002)', () => {
  const slot = (time: string, free = true): AppointmentSlot => ({ time, free });

  it('groups the starts by hour, counting the free ones', () => {
    const hours = slotHours([slot('09:00'), slot('09:30', false), slot('10:00')]);
    expect(hours).toEqual([
      { hour: 9, slots: [slot('09:00'), slot('09:30', false)], free: 1 },
      { hour: 10, slots: [slot('10:00')], free: 1 },
    ]);
  });

  it('splits more than six hours into two columns, the first holding the extra one', () => {
    const hours = Array.from({ length: 7 }, (_, index) => ({
      hour: 9 + index,
      slots: [],
      free: 0,
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
  it('books the draft — a new contact as the contract’s new contact (S:1609)', () => {
    const fresh = booked({
      who: { ...PRIYA, kind: 'new', leadId: null, phone: null, seq: null },
      newPhone: '9876543210',
      reason: '  Acne  ',
    });
    expect(newContactPhone(fresh)).toBe('+919876543210');
    expect(newContactPhone({ ...fresh, newPhone: '98765' })).toBeNull();
    expect(createInputOf(fresh, { branchId: 'b1', leads: [] })).toMatchObject({
      patientId: null,
      leadId: null,
      doctorId: 'dr-1',
      date: TODAY,
      startTime: '11:00',
      branchId: 'b1',
      reason: 'Acne',
      notes: null,
      newContact: { name: 'Priya Shah', phone: '+919876543210' },
    });
    const copy = createInputOf(booked(), {
      branchId: null,
      leads: [lead({})],
      copyOf: 'a9',
    });
    expect(copy).toMatchObject({ leadId: 'lead-1', copyOf: 'a9' });
    expect(copy).not.toHaveProperty('branchId');
    expect(copy).not.toHaveProperty('newContact');
  });

  it('sends only what changed in Edit, the status when a tile moved it', () => {
    const start = draftOf(peel);
    expect(patchOf(start, peel, [])).toEqual({});
    const edited = {
      ...start,
      reason: 'Cheeks',
      time: '12:00',
      doctorId: 'dr-9',
      status: 'scheduled' as const,
    };
    expect(patchOf(edited, peel, [])).toEqual({
      reason: 'Cheeks',
      startTime: '12:00',
      doctorId: 'dr-9',
      status: 'scheduled',
    });
  });
});
