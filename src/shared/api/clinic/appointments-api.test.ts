import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  APPOINTMENT_SIDE_EFFECT_KEYS,
  appointmentQueryKeys,
  cancelAppointment,
  createAppointment,
  fetchAppointment,
  fetchAppointmentDaySummaries,
  fetchAppointmentPage,
  fetchAppointmentRange,
  fetchAvailableSlots,
  fetchBookableStaff,
  normalizeAppointmentListParams,
  restoreAppointment,
  setAppointmentStatus,
  undoAppointmentChange,
  updateAppointment,
} from './appointments-api.ts';
import type { AppointmentRecord } from './appointments-contracts.ts';
import { clinicInstant } from './clinic-time.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { messageQueryKeys } from './messages-api.ts';

const TODAY = '2026-10-03';
const DR = staffRef('DR');
const DD = staffRef('DD');
const DN = staffRef('DN');

/** Set the clinic clock. */
const clock = (date: string, time: string) =>
  vi.setSystemTime(new Date(clinicInstant(date, time)));

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (
    error.data as { error: { code: string; detail: string; fields?: object } }
  ).error;
  return { status: error.status, ...body };
}

const visit = (seq: number): AppointmentRecord => {
  const found = clinicFixtures.appointments.snapshot((row) => row.seq === seq)[0];
  if (!found) throw new Error(`no appointment #${seq}`);
  return found;
};
const patientId = (firstName: string) => {
  const found = clinicFixtures.patients.snapshot((row) => row.firstName === firstName)[0];
  if (!found) throw new Error(`no patient ${firstName}`);
  return found.id;
};
const seqs = (rows: readonly { seq: number }[]) => rows.map((row) => row.seq);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(TODAY, '10:00');
  resetClinicFixtures();
  // Seed every collection now: the seeds date themselves from the clock at
  // their first read, and some tests move the clock before reading.
  for (const collection of Object.values(clinicFixtures)) collection.snapshot();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the Agenda (listAppointments, S:1603)', () => {
  it('lists Active bookings from today on, by day and time', async () => {
    const page = await fetchAppointmentPage({});
    expect(seqs(page.rows)).toEqual([
      2864, 2865, 2866, 2867, 2868, 2847, 2869, 2848, 2858, 2857, 2855, 2850, 2849, 2853,
      2861, 2854, 2856, 2859, 2852,
    ]);
    expect(page).toMatchObject({ next: null, hasMore: false });
  });

  it('reads the one day picked in Filters, past days included', async () => {
    expect(seqs((await fetchAppointmentPage({ date: '2026-10-04' })).rows)).toEqual([
      2858, 2857,
    ]);
    expect(
      seqs((await fetchAppointmentPage({ date: '2026-10-02', status: 'all' })).rows),
    ).toEqual([2841, 2843]);
  });

  it('filters by status, doctor and branch', async () => {
    const confirmed = await fetchAppointmentPage({ status: 'confirmed' });
    expect(seqs(confirmed.rows)).toEqual([2869, 2858, 2861, 2859]);
    const all = await fetchAppointmentPage({ status: 'all', date: TODAY });
    expect(seqs(all.rows)).toContain(2862);
    const nisha = await fetchAppointmentPage({ doctorIds: [DN] });
    expect(new Set(nisha.rows.map((row) => row.doctorId))).toEqual(new Set([DN]));
    const elsewhere = await fetchAppointmentPage({ branchIds: [ref.branch(2)] });
    expect(elsewhere.rows).toEqual([]);
  });

  it('searches name, mobile and #ID, spaces and "#" ignored (Q-A12)', async () => {
    const search = async (q: string) => seqs((await fetchAppointmentPage({ q })).rows);
    expect(await search('rhea')).toEqual([2867, 2861]);
    expect(await search('#2861')).toEqual([2861]);
    expect(await search('98250 11241')).toEqual([2867, 2861]);
    expect(await search('meera j')).toEqual([2847]);
    expect(await search('   ')).toHaveLength(19);
  });

  it('sorts inside each day — Contact, Service or Status, either way — the days stay in order', async () => {
    const sorted = async (key: 'contact' | 'service' | 'status', order: 'asc' | 'desc') =>
      (await fetchAppointmentPage({ sort: key, order })).rows;
    const contacts = await sorted('contact', 'asc');
    expect(contacts.slice(0, 8).map((row) => row.person.name)).toEqual([
      'Dhruv Patel',
      'Faizan Shaikh',
      'Ishita Vora',
      'Meera Joshi',
      'Nikhil Rao',
      'Priti Soni',
      'Rhea Shah',
      'Sana Kapoor',
    ]);
    expect(contacts.map((row) => row.date)).toEqual(
      [...contacts.map((row) => row.date)].sort(),
    );
    const backwards = await sorted('contact', 'desc');
    expect(backwards[0]?.person.name).toBe('Sana Kapoor');
    const statuses = await sorted('status', 'asc');
    expect(seqs(statuses.slice(0, 3))).toEqual([2848, 2869, 2864]);
  });

  it('filters by Created and Follow-up (S:1540–1541)', async () => {
    expect(seqs((await fetchAppointmentPage({ followUp: 'overdue' })).rows)).toEqual([
      2858, 2857,
    ]);
    expect(seqs((await fetchAppointmentPage({ followUp: 'tomorrow' })).rows)).toEqual([
      2855,
    ]);
    const booked = await createAppointment({
      patientId: patientId('Priti'),
      doctorId: DR,
      date: '2026-10-05',
      startTime: '10:00',
    });
    expect(seqs((await fetchAppointmentPage({ created: 'today' })).rows)).toEqual([
      booked.seq,
    ]);
  });

  it('pages 50 at a time, the cursor carrying the order', async () => {
    const template = visit(2849);
    for (let index = 0; index < 55; index += 1) {
      await clinicFixtures.appointments.create({
        ...template,
        date: '2026-10-05',
        startTime: `1${index % 10}:00`,
      });
    }
    const first = await fetchAppointmentPage({});
    expect(first.rows).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    const second = await fetchAppointmentPage({}, first.next ?? undefined);
    expect(first.rows.length + second.rows.length).toBe(19 + 55);
    expect(second.hasMore).toBe(false);
    const dates = [...first.rows, ...second.rows].map((row) => row.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('joins the person, the doctor and the plan', async () => {
    const rows = (await fetchAppointmentPage({})).rows;
    const dharti = rows.find((row) => row.seq === 2859);
    expect(dharti?.person).toMatchObject({ kind: 'patient', name: 'Dharti Galani' });
    expect(dharti?.plan.patient).toBeGreaterThan(0);
    const faizan = rows.find((row) => row.seq === 2869);
    expect(faizan?.person).toMatchObject({
      kind: 'contact',
      name: 'Faizan Shaikh',
      patientId: null,
      seq: null,
    });
    expect(faizan?.doctor).toMatchObject({ id: DN, roles: ['doctor', 'admin'] });
  });

  it('counts each day for its header, however the pages split it (Appendix F)', async () => {
    const days = await fetchAppointmentDaySummaries({});
    expect(days[0]).toEqual({ date: TODAY, total: 8, confirmed: 1, scheduled: 1 });
    expect(days[1]).toEqual({ date: '2026-10-04', total: 2, confirmed: 1, scheduled: 1 });
    expect(days.map((day) => day.date)).toEqual([...days.map((day) => day.date)].sort());
  });
});

describe('the calendars (listAppointmentsRange, S:1602)', () => {
  it('reads every booking in the range by date and time, no paging', async () => {
    const week = await fetchAppointmentRange({ from: TODAY, to: '2026-10-09' });
    expect(seqs(week)).toEqual([
      2864, 2865, 2866, 2867, 2868, 2847, 2869, 2848, 2858, 2857, 2855, 2850, 2849, 2853,
      2861,
    ]);
    const all = await fetchAppointmentRange({
      from: '2026-10-01',
      to: TODAY,
      status: 'all',
    });
    expect(seqs(all).slice(0, 3)).toEqual([2838, 2841, 2843]);
  });

  it('applies the doctor, Created and Follow-up filters there too (§7.3)', async () => {
    const reenal = await fetchAppointmentRange({
      from: TODAY,
      to: '2026-10-31',
      doctorIds: [DR],
    });
    expect(seqs(reenal)).toEqual([2847, 2848, 2861]);
    const overdue = await fetchAppointmentRange({
      from: TODAY,
      to: '2026-10-31',
      followUp: 'overdue',
    });
    expect(seqs(overdue)).toEqual([2858, 2857]);
  });

  it('refuses a range past six weeks or one that ends before it starts (422)', async () => {
    const long = await failureOf(
      fetchAppointmentRange({ from: TODAY, to: '2026-11-14' }),
    );
    expect(long).toMatchObject({ status: 422, code: 'validation' });
    await expect(
      fetchAppointmentRange({ from: TODAY, to: '2026-10-02' }),
    ).rejects.toThrow();
  });
});

describe('one booking (getAppointment, S:1604)', () => {
  it('reads a booking, and answers 404 for an unknown, malformed or deleted id', async () => {
    expect(await fetchAppointment(ref.appointment(2861))).toMatchObject({
      seq: 2861,
      repliedYes: true,
      moveCount: 1,
      person: { name: 'Rhea Shah' },
    });
    expect((await failureOf(fetchAppointment(ref.appointment(1)))).status).toBe(404);
    expect((await failureOf(fetchAppointment('not-an-id'))).status).toBe(404);
    await clinicFixtures.appointments.remove(ref.appointment(2861), 'mistake', null);
    expect((await failureOf(fetchAppointment(ref.appointment(2861)))).status).toBe(404);
  });
});

describe('who can be booked', () => {
  it('lists the doctors, then the therapists, with their real roles', async () => {
    const staff = await fetchBookableStaff();
    expect(
      staff.map((member) => `${member.firstName} ${member.lastName ?? ''}`.trim()),
    ).toEqual([
      'Dr. Drashti Moradiya',
      'Dr. Karan Shah',
      'Dr. Nisha Mavani',
      'Dr. Reenal Chaniyara',
      'Kiran P.',
      'Ridhi Sohaliya',
    ]);
    expect(staff.at(-1)?.roles).toEqual(['therapist']);
  });
});

describe('the slot grid (availableSlots, S:1605; Q-A3, Q-A4)', () => {
  it('offers the doctor’s hours inside the branch’s, every step', async () => {
    const slots = await fetchAvailableSlots({
      date: '2026-10-05',
      doctorId: DR,
      durationMin: 30,
    });
    expect(slots[0]).toEqual({ time: '10:00', free: true });
    expect(slots.at(-1)).toEqual({ time: '18:30', free: true });
    expect(slots).toHaveLength(18);
    const quarters = await fetchAvailableSlots({
      date: '2026-10-05',
      doctorId: DR,
      durationMin: 30,
      step: 15,
    });
    expect(quarters.slice(0, 3).map((slot) => slot.time)).toEqual([
      '10:00',
      '10:15',
      '10:30',
    ]);
  });

  it('marks a slot taken when the same doctor’s booking overlaps it', async () => {
    const slots = await fetchAvailableSlots({
      date: '2026-10-09',
      doctorId: DR,
      durationMin: 60,
    });
    const at = (time: string) => slots.find((slot) => slot.time === time)?.free;
    expect(at('15:00')).toBe(true);
    expect(at('15:30')).toBe(false);
    expect(at('16:30')).toBe(false);
    expect(at('17:00')).toBe(true);
    const ownSlot = await fetchAvailableSlots({
      date: '2026-10-09',
      doctorId: DR,
      durationMin: 60,
      exceptId: ref.appointment(2861),
    });
    expect(ownSlot.find((slot) => slot.time === '16:00')?.free).toBe(true);
  });

  it('leaves out the passed starts, past days and days off', async () => {
    const today = await fetchAvailableSlots({
      date: TODAY,
      doctorId: DR,
      durationMin: 30,
    });
    expect(today[0]?.time).toBe('10:30');
    expect(today.find((slot) => slot.time === '11:00')?.free).toBe(false);
    expect(
      await fetchAvailableSlots({ date: '2026-10-02', doctorId: DR, durationMin: 30 }),
    ).toEqual([]);
    // Saturday: Dr. Drashti works Monday to Friday; Sunday: the branch is closed.
    expect(
      await fetchAvailableSlots({ date: TODAY, doctorId: DD, durationMin: 30 }),
    ).toEqual([]);
    expect(
      await fetchAvailableSlots({ date: '2026-10-04', doctorId: DR, durationMin: 30 }),
    ).toEqual([]);
  });

  it('refuses a staff member who can’t be booked (422)', async () => {
    const desk = await failureOf(
      fetchAvailableSlots({
        date: '2026-10-05',
        doctorId: staffRef('RS'),
        durationMin: 30,
      }),
    );
    expect(desk).toMatchObject({ status: 422, fields: { doctorId: ['Pick a doctor'] } });
  });
});

describe('booking (createAppointment, S:1609)', () => {
  it('books a patient as Scheduled, the type’s length and Reason and Notes kept (Q-A9)', async () => {
    const booked = await createAppointment({
      patientId: patientId('Priti'),
      doctorId: DR,
      date: '2026-10-05',
      startTime: '10:00',
      type: 'follow_up',
      serviceLabel: 'Follow-up',
      reason: 'Pigmentation on cheeks',
      notes: '  ',
    });
    expect(booked).toMatchObject({
      seq: 2870,
      status: 'scheduled',
      durationMin: 15,
      reason: 'Pigmentation on cheeks',
      notes: null,
      reminder: null,
      repliedYes: false,
      moveCount: 0,
      person: { kind: 'patient', name: 'Priti Soni' },
    });
    expect(await fetchAppointment(booked.id)).toMatchObject({ seq: 2870 });
  });

  it('names the service after the offering, and links a copy to its source', async () => {
    const offering = clinicFixtures.offerings.snapshot()[0];
    if (!offering) throw new Error('no offering');
    const booked = await createAppointment({
      leadId: visit(2857).leadId,
      doctorId: DR,
      date: '2026-10-05',
      startTime: '11:00',
      type: 'treatment',
      offeringId: offering.id,
      copyOf: ref.appointment(2857),
    });
    expect(booked).toMatchObject({
      serviceLabel: offering.name,
      durationMin: 60,
      copiedFromId: ref.appointment(2857),
      person: { kind: 'contact', name: 'Ridhi Delvadiya' },
    });
  });

  it('raises the rule job’s "Confirm visits" task with the booking (48 hours ahead)', async () => {
    const booked = await createAppointment({
      patientId: patientId('Priti'),
      doctorId: DR,
      date: '2026-10-05',
      startTime: '10:00',
    });
    expect(
      clinicFixtures.tasks.snapshot(
        (task) => task.rule === 'confirm' && task.sourceId === booked.id,
      ),
    ).toHaveLength(1);
  });

  it('refuses no one to book, an unknown doctor and a past, closed or taken slot', async () => {
    const base = { patientId: patientId('Priti'), doctorId: DR, date: '2026-10-05' };
    expect(
      await failureOf(
        createAppointment({ doctorId: DR, date: '2026-10-05', startTime: '10:00' }),
      ),
    ).toMatchObject({ status: 422, detail: 'Pick who the appointment is for' });
    expect(
      await failureOf(
        createAppointment({ ...base, doctorId: staffRef('RS'), startTime: '10:00' }),
      ),
    ).toMatchObject({ status: 422, detail: 'Pick a doctor' });
    expect(
      await failureOf(createAppointment({ ...base, date: TODAY, startTime: '09:00' })),
    ).toMatchObject({ status: 422, detail: 'That time has passed · pick a future slot' });
    expect(
      await failureOf(createAppointment({ ...base, startTime: '19:50' })),
    ).toMatchObject({ status: 422, detail: 'Pick a time inside clinic hours' });
    expect(
      await failureOf(
        createAppointment({ ...base, date: '2026-10-04', startTime: '11:00' }),
      ),
    ).toMatchObject({ status: 422, detail: 'Pick a time inside clinic hours' });
    expect(
      await failureOf(
        createAppointment({ ...base, date: '2026-10-09', startTime: '16:30' }),
      ),
    ).toMatchObject({
      status: 409,
      code: 'slot_taken',
      detail: 'Just taken · pick another slot',
    });
    expect(
      await failureOf(createAppointment({ ...base, startTime: '10:00', durationMin: 7 })),
    ).toMatchObject({
      status: 422,
      fields: { durationMin: ['Pick a length in steps of 5 minutes'] },
    });
  });
});

describe('editing (updateAppointment, S:1610)', () => {
  it('saves fields on the same slot — not a move', async () => {
    const { appointment, moved } = await updateAppointment(ref.appointment(2861), {
      notes: 'Prefers the evening',
    });
    expect(moved).toBe(false);
    expect(appointment).toMatchObject({
      status: 'confirmed',
      notes: 'Prefers the evening',
    });
  });

  it('moves a Confirmed booking back to Scheduled, from the old slot, one move more', async () => {
    const { appointment, moved } = await updateAppointment(ref.appointment(2861), {
      date: '2026-10-12',
      startTime: '11:00',
    });
    expect(moved).toBe(true);
    expect(appointment).toMatchObject({
      status: 'scheduled',
      date: '2026-10-12',
      startTime: '11:00',
      rescheduledFrom: clinicInstant('2026-10-09', '16:00'),
      moveCount: 2,
      repliedYes: false,
      reminder: null,
    });
  });

  it('locks the slot once checked in, and refuses a move onto a taken slot', async () => {
    expect(
      await failureOf(updateAppointment(ref.appointment(2847), { startTime: '12:00' })),
    ).toMatchObject({
      status: 409,
      detail: 'Date & time are locked once the patient is checked in',
    });
    expect(
      await failureOf(
        updateAppointment(ref.appointment(2848), {
          date: '2026-10-09',
          startTime: '16:00',
        }),
      ),
    ).toMatchObject({ status: 409, code: 'slot_taken' });
  });

  it('takes the form’s status — a patient’s visit completes on its day, both stamps at once', async () => {
    const { appointment } = await updateAppointment(ref.appointment(2848), {
      status: 'completed',
    });
    expect(appointment.status).toBe('completed');
    expect(appointment.checkedInAt).toBe(new Date().toISOString());
    expect(appointment.completedAt).toBe(new Date().toISOString());
  });

  it('refuses a status the tiles would not offer (409 with the guard’s words)', async () => {
    expect(
      await failureOf(updateAppointment(ref.appointment(2869), { status: 'completed' })),
    ).toMatchObject({
      status: 409,
      detail: 'Create the patient record first · Completed needs a patient',
    });
    expect(
      await failureOf(updateAppointment(ref.appointment(2858), { status: 'checked_in' })),
    ).toMatchObject({ status: 409, detail: 'Only on Tomorrow' });
    expect(
      await failureOf(updateAppointment(ref.appointment(2863), { status: 'checked_in' })),
    ).toMatchObject({
      status: 409,
      detail: 'Final status. Use Rebook to make a new appointment.',
    });
  });

  it('takes no edit on a cancelled or no-show booking, and 404s an unknown one', async () => {
    await cancelAppointment({
      id: ref.appointment(2857),
      reason: 'unreachable',
      note: null,
    });
    expect(
      (await failureOf(updateAppointment(ref.appointment(2857), { notes: 'x' }))).status,
    ).toBe(409);
    expect(
      (await failureOf(updateAppointment(ref.appointment(2862), { notes: 'x' }))).status,
    ).toBe(409);
    expect(
      (await failureOf(updateAppointment(ref.appointment(1), { notes: 'x' }))).status,
    ).toBe(404);
  });
});

describe('status moves (setAppointmentStatus, S:1582) and their Undo', () => {
  it('confirms, and Undo puts it back', async () => {
    const { appointment, undoToken } = await setAppointmentStatus({
      id: ref.appointment(2848),
      status: 'confirmed',
    });
    expect(appointment.status).toBe('confirmed');
    await undoAppointmentChange(undoToken);
    expect(visit(2848).status).toBe('scheduled');
    expect((await failureOf(undoAppointmentChange(undoToken))).status).toBe(409);
  });

  it('refuses the guarded moves with the popover’s words (409)', async () => {
    expect(
      await failureOf(
        setAppointmentStatus({ id: ref.appointment(2848), status: 'no_show' }),
      ),
    ).toMatchObject({ status: 409, detail: 'Available after 11:30 am on Today' });
    expect(
      await failureOf(
        setAppointmentStatus({ id: ref.appointment(2857), status: 'checked_in' }),
      ),
    ).toMatchObject({ status: 409, detail: 'Only on Tomorrow' });
    expect(
      await failureOf(
        setAppointmentStatus({ id: ref.appointment(2848), status: 'completed' }),
      ),
    ).toMatchObject({ status: 409, detail: 'Scheduled can’t move to Completed' });
    expect(
      await failureOf(
        setAppointmentStatus({ id: ref.appointment(2863), status: 'confirmed' }),
      ),
    ).toMatchObject({
      status: 409,
      detail: 'Final status. Use Rebook to make a new appointment.',
    });
  });

  it('marks a no-show after the start; the Rebook task follows, and Undo takes both back', async () => {
    clock(TODAY, '11:45');
    const { undoToken } = await setAppointmentStatus({
      id: ref.appointment(2848),
      status: 'no_show',
    });
    const rebook = () =>
      clinicFixtures.tasks.snapshot(
        (task) => task.rule === 'rebook' && task.sourceId === ref.appointment(2848),
      );
    expect(rebook().map((task) => task.title)).toEqual(['Rebook Priti']);
    await undoAppointmentChange(undoToken);
    expect(visit(2848).status).toBe('scheduled');
    expect(rebook()).toEqual([]);
  });

  it('checks in: the stamp, and the person’s open leads → Clinic visited with a line; Undo reverts all', async () => {
    clock('2026-10-09', '15:50');
    const lead = () => clinicFixtures.leads.snapshot((row) => row.seq === 2365)[0];
    const lines = () =>
      clinicFixtures.leadMessages.snapshot(
        (message) => message.leadId === lead()?.id && message.isSystem,
      );
    const before = lines().length;
    const { appointment, undoToken } = await setAppointmentStatus({
      id: ref.appointment(2861),
      status: 'checked_in',
    });
    expect(appointment.checkedInAt).toBe(new Date().toISOString());
    expect(lead()?.status).toBe('clinic_visited');
    expect(lines().at(-1)?.body).toBe(
      'Status → Clinic visited · checked in for appointment #2861',
    );
    // A closed lead of the same person stays as it was.
    expect(clinicFixtures.leads.snapshot((row) => row.seq === 2210)[0]?.status).toBe(
      'clinic_visited',
    );
    await undoAppointmentChange(undoToken);
    expect(visit(2861)).toMatchObject({ status: 'confirmed', checkedInAt: null });
    expect(lead()?.status).toBe('new');
    expect(lines()).toHaveLength(before);
  });

  it('completes a checked-in patient’s visit', async () => {
    const { appointment } = await setAppointmentStatus({
      id: ref.appointment(2847),
      status: 'completed',
    });
    expect(appointment.completedAt).toBe(new Date().toISOString());
    expect(appointment.checkedInAt).toBe(visit(2847).checkedInAt);
  });
});

describe('cancel and restore (S:1611–1612)', () => {
  it('cancels with the contract’s reason, and Undo brings back the status it had', async () => {
    const { appointment, undoToken } = await cancelAppointment({
      id: ref.appointment(2858),
      reason: 'patient_asked',
      note: null,
    });
    expect(appointment).toMatchObject({
      status: 'cancelled',
      cancelReason: 'patient_asked',
      cancelNote: null,
    });
    await undoAppointmentChange(undoToken);
    expect(visit(2858)).toMatchObject({ status: 'confirmed', cancelReason: null });
  });

  it('needs a note for "Other" (422) and keeps it', async () => {
    expect(
      await failureOf(
        cancelAppointment({ id: ref.appointment(2858), reason: 'other', note: null }),
      ),
    ).toMatchObject({ status: 422, fields: { note: ['Add a short note for "Other"'] } });
    const { appointment } = await cancelAppointment({
      id: ref.appointment(2858),
      reason: 'other',
      note: 'Booked by mistake',
    });
    expect(appointment).toMatchObject({
      cancelReason: 'other',
      cancelNote: 'Booked by mistake',
    });
  });

  it('cancels nothing final', async () => {
    expect(
      (
        await failureOf(
          cancelAppointment({
            id: ref.appointment(2863),
            reason: 'patient_asked',
            note: null,
          }),
        )
      ).status,
    ).toBe(409);
  });

  it('restores to Scheduled while the time is ahead, the reminder going out again', async () => {
    await cancelAppointment({
      id: ref.appointment(2858),
      reason: 'unreachable',
      note: null,
    });
    const restored = await restoreAppointment(ref.appointment(2858));
    expect(restored).toMatchObject({
      status: 'scheduled',
      cancelReason: null,
      cancelNote: null,
      reminder: null,
    });
  });

  it('refuses a restore once the time passed, onto a taken slot, or of a live booking', async () => {
    await cancelAppointment({
      id: ref.appointment(2848),
      reason: 'unreachable',
      note: null,
    });
    clock(TODAY, '11:45');
    expect(await failureOf(restoreAppointment(ref.appointment(2848)))).toMatchObject({
      status: 409,
      detail: 'This time has passed · book a new appointment',
    });
    await cancelAppointment({
      id: ref.appointment(2861),
      reason: 'unreachable',
      note: null,
    });
    await createAppointment({
      patientId: patientId('Priti'),
      doctorId: DR,
      date: '2026-10-09',
      startTime: '16:00',
    });
    expect(await failureOf(restoreAppointment(ref.appointment(2861)))).toMatchObject({
      status: 409,
      detail: 'Just taken · pick another slot',
    });
    expect(await failureOf(restoreAppointment(ref.appointment(2859)))).toMatchObject({
      status: 409,
      detail: 'Only a cancelled appointment can be restored',
    });
  });
});

describe('query keys', () => {
  it('keep every read under the prefix task writes invalidate, equal filters alike', () => {
    expect(appointmentQueryKeys.all).toEqual(['clinic', 'appointments']);
    expect(appointmentQueryKeys.list({ doctorIds: [DR, DN, DR] })).toEqual(
      appointmentQueryKeys.list({ doctorIds: [DN, DR], q: '  ' }),
    );
    expect(appointmentQueryKeys.detail('x').slice(0, 2)).toEqual([
      'clinic',
      'appointments',
    ]);
    expect(normalizeAppointmentListParams()).toMatchObject({
      status: 'active',
      doctorIds: [],
    });
  });

  it('refresh the chat column after a write — its system line, history and offered slots', () => {
    const reads = [
      messageQueryKeys.thread('lead:x'),
      messageQueryKeys.history('lead:x'),
      messageQueryKeys.templateValues('lead:x'),
    ];
    const refreshed = (key: readonly string[]) =>
      APPOINTMENT_SIDE_EFFECT_KEYS.some((prefix) =>
        prefix.every((part, index) => key[index] === part),
      );
    for (const key of reads) expect(refreshed(key)).toBe(true);
  });
});
