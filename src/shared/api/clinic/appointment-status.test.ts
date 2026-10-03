import { describe, expect, it } from 'vitest';

import {
  allowedNext,
  APPOINTMENT_FLOW,
  APPOINTMENT_STATUS_EFFECTS,
  type AppointmentFormCancelReason,
  type AppointmentGuardSubject,
  type AppointmentMove,
  appointmentMoveOptions,
  CANCEL_REASON_GROUPS,
  cancelReasonToContract,
  formStatusGuard,
  formStatusHint,
  formTiles,
  hasAppointmentStarted,
  isAppointmentSlotLocked,
  isFinalAppointmentStatus,
  NEXT_ACTION_MOVES,
  nextAction,
  restoreGuard,
  transitionGuard,
} from './appointment-status.ts';
import {
  APPOINTMENT_STATUS_VALUES,
  type AppointmentStatus,
  CANCEL_REASON_VALUES,
} from './clinic-schema.ts';
import { clinicInstant } from './clinic-time.ts';

const TODAY = '2026-10-03';
const TOMORROW = '2026-10-04';
const YESTERDAY = '2026-10-02';
/** 10:00 on the clinic clock, 3 Oct. */
const NOW = new Date(clinicInstant(TODAY, '10:00'));
const MOVES: readonly AppointmentMove[] = [
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
  'reschedule',
];

const subject = (
  status: AppointmentStatus,
  overrides: Partial<AppointmentGuardSubject> = {},
): AppointmentGuardSubject => ({
  status,
  date: TODAY,
  startTime: '09:30',
  isPatient: true,
  ...overrides,
});

describe('the transition table (S:1137–1145, H:3422)', () => {
  it('offers exactly the designed moves from each status, in the popover’s order', () => {
    expect(APPOINTMENT_FLOW).toEqual({
      scheduled: ['confirmed', 'checked_in', 'reschedule', 'cancelled', 'no_show'],
      confirmed: ['checked_in', 'reschedule', 'cancelled', 'no_show'],
      checked_in: ['completed'],
      completed: [],
      cancelled: [],
      no_show: [],
    });
    for (const status of APPOINTMENT_STATUS_VALUES) {
      expect(allowedNext(status)).toBe(APPOINTMENT_FLOW[status]);
    }
  });

  it('never moves back to Scheduled by a status — only by a reschedule', () => {
    for (const moves of Object.values(APPOINTMENT_FLOW)) {
      expect(moves).not.toContain('scheduled');
    }
  });

  it('names Completed, Cancelled and No show final, and locks the slot after check-in', () => {
    expect(APPOINTMENT_STATUS_VALUES.filter(isFinalAppointmentStatus)).toEqual([
      'completed',
      'cancelled',
      'no_show',
    ]);
    expect(APPOINTMENT_STATUS_VALUES.filter(isAppointmentSlotLocked)).toEqual([
      'checked_in',
      'completed',
    ]);
  });
});

describe('transitionGuard — every status × every move', () => {
  // A booking on the visit day, already started, for a patient: only the
  // table itself decides here.
  const open = { now: new Date(clinicInstant(TODAY, '10:00')) };

  it.each(
    APPOINTMENT_STATUS_VALUES.flatMap((status) => MOVES.map((move) => [status, move])),
  )('%s → %s follows the table', (status, move) => {
    const guard = transitionGuard(
      subject(status as AppointmentStatus),
      move as AppointmentMove,
      open,
    );
    const inTable = APPOINTMENT_FLOW[status as AppointmentStatus].includes(
      move as AppointmentMove,
    );
    if (isFinalAppointmentStatus(status as AppointmentStatus)) {
      expect(guard).toEqual({ allowed: false, reason: 'final' });
    } else if (inTable) {
      expect(guard).toEqual({ allowed: true });
    } else {
      expect(guard).toEqual({ allowed: false, reason: 'not_allowed' });
    }
  });

  it('blocks every move without Edit, before anything else (Q-A16)', () => {
    for (const move of MOVES) {
      expect(
        transitionGuard(subject('scheduled'), move, { ...open, canEdit: false }),
      ).toEqual({ allowed: false, reason: 'no_access' });
    }
  });

  it('checks in only on the visit day ("Only on <day>")', () => {
    for (const status of ['scheduled', 'confirmed'] as const) {
      expect(transitionGuard(subject(status), 'checked_in', open).allowed).toBe(true);
      for (const date of [TOMORROW, YESTERDAY]) {
        expect(transitionGuard(subject(status, { date }), 'checked_in', open)).toEqual({
          allowed: false,
          reason: 'visit_day',
        });
      }
    }
  });

  it('marks a no-show only once the start has passed ("Available after <time> on <day>")', () => {
    const at = (time: string) => ({ now: new Date(clinicInstant(TODAY, time)) });
    const booking = subject('scheduled', { startTime: '11:30' });
    expect(transitionGuard(booking, 'no_show', at('11:29'))).toEqual({
      allowed: false,
      reason: 'before_start',
    });
    expect(transitionGuard(booking, 'no_show', at('11:30')).allowed).toBe(true);
    expect(
      transitionGuard(subject('confirmed', { date: TOMORROW }), 'no_show', open),
    ).toEqual({ allowed: false, reason: 'before_start' });
    expect(
      transitionGuard(subject('confirmed', { date: YESTERDAY }), 'no_show', open),
    ).toEqual({ allowed: true });
  });

  it('completes only a patient’s visit — a lead or contact needs a patient record first', () => {
    expect(transitionGuard(subject('checked_in'), 'completed', open).allowed).toBe(true);
    expect(
      transitionGuard(subject('checked_in', { isPatient: false }), 'completed', open),
    ).toEqual({ allowed: false, reason: 'needs_patient' });
  });

  it('lets a booking move or cancel on any day, past ones included', () => {
    for (const date of [YESTERDAY, TODAY, TOMORROW]) {
      expect(
        transitionGuard(subject('scheduled', { date }), 'reschedule', open).allowed,
      ).toBe(true);
      expect(
        transitionGuard(subject('confirmed', { date }), 'cancelled', open).allowed,
      ).toBe(true);
    }
  });

  it('lists the popover’s options with their guards', () => {
    const options = appointmentMoveOptions(
      subject('scheduled', { date: TOMORROW }),
      open,
    );
    expect(options.map((option) => [option.move, option.guard.allowed])).toEqual([
      ['confirmed', true],
      ['checked_in', false],
      ['reschedule', true],
      ['cancelled', true],
      ['no_show', false],
    ]);
    expect(appointmentMoveOptions(subject('completed'), open)).toEqual([]);
  });
});

describe('hasAppointmentStarted (the clinic clock, minute precision)', () => {
  it('reads past days, the start minute and future days', () => {
    expect(hasAppointmentStarted({ date: YESTERDAY, startTime: '23:59' }, NOW)).toBe(
      true,
    );
    expect(hasAppointmentStarted({ date: TODAY, startTime: '10:00' }, NOW)).toBe(true);
    expect(hasAppointmentStarted({ date: TODAY, startTime: '10:01' }, NOW)).toBe(false);
    expect(hasAppointmentStarted({ date: TOMORROW, startTime: '00:00' }, NOW)).toBe(
      false,
    );
  });
});

describe('restoreGuard (Restore → Scheduled until the time passes)', () => {
  const cancelled = (overrides: Partial<AppointmentGuardSubject> = {}) =>
    subject('cancelled', { startTime: '11:00', ...overrides });

  it('restores a cancelled booking whose start is still ahead', () => {
    expect(restoreGuard(cancelled(), { now: NOW })).toEqual({ allowed: true });
    expect(
      restoreGuard(cancelled({ date: TOMORROW, startTime: '09:00' }), { now: NOW }),
    ).toEqual({ allowed: true });
  });

  it('refuses once the time has passed, for anything not cancelled, and without Edit', () => {
    expect(restoreGuard(cancelled({ startTime: '09:59' }), { now: NOW })).toEqual({
      allowed: false,
      reason: 'time_passed',
    });
    expect(
      restoreGuard(subject('scheduled', { startTime: '11:00' }), { now: NOW }),
    ).toEqual({
      allowed: false,
      reason: 'not_cancelled',
    });
    expect(restoreGuard(cancelled(), { now: NOW, canEdit: false })).toEqual({
      allowed: false,
      reason: 'no_access',
    });
  });
});

describe('nextAction (the card’s next step, H:5900)', () => {
  it.each([
    ['scheduled', TODAY, 'check_in'],
    ['confirmed', TODAY, 'check_in'],
    ['scheduled', TOMORROW, 'confirm'],
    ['confirmed', TOMORROW, null],
    ['checked_in', TODAY, 'complete'],
    ['no_show', YESTERDAY, 'rebook'],
    ['completed', TODAY, null],
    ['cancelled', TOMORROW, null],
  ] as const)('%s on %s → %s', (status, date, action) => {
    expect(nextAction({ status, date }, TODAY)).toBe(action);
  });

  it('maps each step to its move — Rebook makes a new booking instead', () => {
    expect(NEXT_ACTION_MOVES).toEqual({
      check_in: 'checked_in',
      confirm: 'confirmed',
      complete: 'completed',
      rebook: null,
    });
  });
});

describe('formTiles (the form’s Visit status, H:6038)', () => {
  const tiles = (
    input: Partial<Parameters<typeof formTiles>[0]> & { saved: AppointmentStatus },
  ) =>
    formTiles({
      draft: input.saved,
      date: TODAY,
      today: TODAY,
      isPatient: true,
      canEdit: true,
      ...input,
    });
  const pickable = (list: ReturnType<typeof formTiles>) =>
    list.filter((tile) => tile.pickable).map((tile) => tile.status);
  const reasons = (list: ReturnType<typeof formTiles>) =>
    Object.fromEntries(list.map((tile) => [tile.status, tile.reason]));
  const steps = (list: ReturnType<typeof formTiles>) => list.map((tile) => tile.step);

  it('offers Scheduled, Confirmed and Checked in on the visit day', () => {
    const list = tiles({ saved: 'scheduled' });
    expect(pickable(list)).toEqual(['scheduled', 'confirmed', 'checked_in']);
    expect(reasons(list).completed).toBe('after_check_in');
    expect(steps(list)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('offers only Scheduled and Confirmed on other days', () => {
    const list = tiles({ saved: 'confirmed', date: TOMORROW });
    expect(pickable(list)).toEqual(['scheduled', 'confirmed']);
    expect(reasons(list)).toMatchObject({
      checked_in: 'visit_day',
      completed: 'after_check_in',
    });
    expect(steps(list)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
  });

  it('offers Checked in and Completed after check-in — the draft’s, like the prototype', () => {
    const list = tiles({ saved: 'confirmed', draft: 'checked_in' });
    expect(pickable(list)).toEqual(['checked_in', 'completed']);
    expect(reasons(list)).toMatchObject({ scheduled: 'booked', confirmed: 'said_yes' });
    expect(steps(list)).toEqual(['done', 'done', 'current', 'upcoming']);
  });

  it('keeps Completed from a lead or contact — the tile still answers with its toast', () => {
    const list = tiles({ saved: 'checked_in', isPatient: false });
    expect(pickable(list)).toEqual(['checked_in']);
    expect(reasons(list).completed).toBe('needs_patient');
  });

  it('makes Completed final once saved — nothing steps back (Q-A7)', () => {
    const list = tiles({ saved: 'completed' });
    expect(pickable(list)).toEqual([]);
    expect(new Set(Object.values(reasons(list)))).toEqual(new Set(['final']));
    expect(steps(list)).toEqual(['done', 'done', 'done', 'current']);
  });

  it('leaves every tile inert on a Cancelled or No-show booking', () => {
    for (const saved of ['cancelled', 'no_show'] as const) {
      const list = tiles({ saved });
      expect(pickable(list)).toEqual([]);
      expect(new Set(Object.values(reasons(list)))).toEqual(new Set(['closed']));
      expect(steps(list)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
    }
  });

  it('leaves every tile inert without Edit (Therapists read only)', () => {
    const list = tiles({ saved: 'scheduled', canEdit: false });
    expect(pickable(list)).toEqual([]);
    expect(new Set(Object.values(reasons(list)))).toEqual(new Set(['no_access']));
  });
});

describe('formStatusHint (appointments.md:376)', () => {
  it('reads the draft, a non-patient in the clinic, or a closed booking', () => {
    expect(
      formStatusHint({ saved: 'scheduled', draft: 'confirmed', isPatient: true }),
    ).toBe('confirmed');
    expect(
      formStatusHint({ saved: 'scheduled', draft: 'checked_in', isPatient: false }),
    ).toBe('needs_patient');
    expect(
      formStatusHint({ saved: 'checked_in', draft: 'completed', isPatient: true }),
    ).toBe('completed');
    expect(
      formStatusHint({ saved: 'cancelled', draft: 'cancelled', isPatient: true }),
    ).toBe('cancelled');
    expect(formStatusHint({ saved: 'no_show', draft: 'no_show', isPatient: true })).toBe(
      'closed',
    );
  });
});

describe('formStatusGuard (a form save that changes the status)', () => {
  const context = { date: TODAY, today: TODAY, isPatient: true };
  const verdict = (
    saved: AppointmentStatus,
    next: AppointmentStatus,
    overrides: Partial<typeof context> = {},
  ) => formStatusGuard(saved, next, { ...context, ...overrides });

  it('keeps the saved status and confirms or un-confirms before arrival', () => {
    for (const status of APPOINTMENT_STATUS_VALUES) {
      expect(verdict(status, status).allowed).toBe(true);
    }
    expect(verdict('scheduled', 'confirmed').allowed).toBe(true);
    expect(verdict('confirmed', 'scheduled', { date: TOMORROW }).allowed).toBe(true);
    expect(verdict('checked_in', 'scheduled')).toEqual({
      allowed: false,
      reason: 'not_allowed',
    });
  });

  it('checks in on the visit day and completes after check-in, patients only', () => {
    expect(verdict('confirmed', 'checked_in').allowed).toBe(true);
    expect(verdict('confirmed', 'checked_in', { date: TOMORROW })).toEqual({
      allowed: false,
      reason: 'visit_day',
    });
    expect(verdict('checked_in', 'completed', { date: YESTERDAY }).allowed).toBe(true);
    expect(verdict('scheduled', 'completed').allowed).toBe(true);
    expect(verdict('scheduled', 'completed', { date: TOMORROW })).toEqual({
      allowed: false,
      reason: 'visit_day',
    });
    expect(verdict('checked_in', 'completed', { isPatient: false })).toEqual({
      allowed: false,
      reason: 'needs_patient',
    });
  });

  it('never cancels or marks a no-show through an edit, and moves nothing out of a final status', () => {
    expect(verdict('scheduled', 'cancelled').reason).toBe('not_allowed');
    expect(verdict('scheduled', 'no_show').reason).toBe('not_allowed');
    expect(verdict('completed', 'checked_in').reason).toBe('final');
    expect(verdict('cancelled', 'scheduled').reason).toBe('final');
    expect(verdict('no_show', 'scheduled').reason).toBe('final');
  });
});

describe('cancel reasons (D32, A-A3)', () => {
  it('groups exactly the contract’s cancel_reason by side', () => {
    expect(CANCEL_REASON_GROUPS.flatMap((group) => group.reasons).sort()).toEqual(
      [...CANCEL_REASON_VALUES].sort(),
    );
    expect(CANCEL_REASON_GROUPS.map((group) => group.side)).toEqual([
      'patient',
      'clinic',
    ]);
  });

  it('stores the form’s reasons as the contract’s, the extras as Other with their label', () => {
    const stored = (reason: AppointmentFormCancelReason) =>
      cancelReasonToContract(reason, {
        note: 'Out of town',
        label: `Label of ${reason}`,
      });
    expect(stored('patient_cancelled')).toEqual({ reason: 'patient_asked', note: null });
    expect(stored('doctor_unavailable')).toEqual({
      reason: 'doctor_unavailable',
      note: null,
    });
    expect(stored('rescheduling_later')).toEqual({
      reason: 'other',
      note: 'Label of rescheduling_later',
    });
    expect(stored('booked_by_mistake')).toEqual({
      reason: 'other',
      note: 'Label of booked_by_mistake',
    });
    expect(stored('other')).toEqual({ reason: 'other', note: 'Out of town' });
    expect(cancelReasonToContract('other', { note: '  ', label: 'Other' })).toEqual({
      reason: 'other',
      note: null,
    });
  });
});

describe('APPOINTMENT_STATUS_EFFECTS (KICKOFF §6.4 Side effects)', () => {
  it('names every status’s effects', () => {
    expect(Object.keys(APPOINTMENT_STATUS_EFFECTS).sort()).toEqual(
      [...APPOINTMENT_STATUS_VALUES].sort(),
    );
    expect(APPOINTMENT_STATUS_EFFECTS.scheduled).toContain('confirmTask');
    expect(APPOINTMENT_STATUS_EFFECTS.no_show).toEqual(['noShowTask']);
    expect(APPOINTMENT_STATUS_EFFECTS.completed).toEqual([
      'completeStamp',
      'leadsVisited',
      'feedbackTask',
    ]);
    expect(APPOINTMENT_STATUS_EFFECTS.checked_in).toContain('leadsVisited');
    expect(APPOINTMENT_STATUS_EFFECTS.cancelled).toEqual([
      'releaseSlot',
      'stopReminders',
    ]);
  });
});
