import { describe, expect, it } from 'vitest';

import { appointmentRow as booking } from '@/tests/utils/appointment-doubles.ts';

import {
  agendaGroupLabel,
  blockPersonTone,
  dayGroupTone,
  latestEvent,
  PERSON_TONES,
} from './appointments.display.ts';

describe('blockPersonTone (avTone, H:5892)', () => {
  it('paints a patient sage and everyone else lav on a calendar block', () => {
    expect(blockPersonTone('patient')).toBe('sage');
    expect(blockPersonTone('lead')).toBe('lav');
    expect(blockPersonTone('contact')).toBe('lav');
  });
});

describe('dayGroupTone', () => {
  it('is sage today, else sky · lav · blush · butter · mint by the group’s place', () => {
    expect(dayGroupTone('2026-10-03', '2026-10-03', 4)).toBe('sage');
    expect(
      [0, 1, 2, 3, 4, 5].map((index) => dayGroupTone('2026-10-09', '2026-10-03', index)),
    ).toEqual(['sky', 'lav', 'blush', 'butter', 'mint', 'sky']);
  });
});

describe('agendaGroupLabel (H:5906)', () => {
  const today = '2026-10-03';
  it.each([
    ['2026-10-03', 'today', { kind: 'weekday' }],
    ['2026-10-04', 'tomorrow', { kind: 'weekday' }],
    ['2026-10-05', 'weekday', { kind: 'inDays', days: 2 }],
    ['2026-10-09', 'weekday', { kind: 'inDays', days: 6 }],
    ['2026-10-10', 'weekday', { kind: 'nextWeek' }],
    ['2026-10-16', 'weekday', { kind: 'nextWeek' }],
    ['2026-10-17', 'weekday', { kind: 'inWeeks', weeks: 2 }],
    ['2026-10-31', 'weekday', { kind: 'inWeeks', weeks: 4 }],
    ['2026-10-02', 'weekday', { kind: 'yesterday' }],
    ['2026-09-28', 'weekday', { kind: 'daysAgo', days: 5 }],
  ] as const)('%s is %s with %o', (date, label, sub) => {
    expect(agendaGroupLabel(date, today)).toEqual({ label, sub });
  });
});

describe('PERSON_TONES (H:5972)', () => {
  it('paints the Agenda’s patients sage, leads lav and anyone else grey', () => {
    expect(PERSON_TONES).toEqual({ patient: 'sage', lead: 'lav', contact: 'stone' });
  });
});

describe('latestEvent — the "Latest update" pill (H:5971)', () => {
  it('is nothing ("—") for a booking without an event', () => {
    expect(latestEvent(booking())).toBeNull();
    expect(latestEvent(booking({ status: 'cancelled' }))).toBeNull();
  });

  it('says "Reminder sent" once the server has sent it — nothing for the other reminder states', () => {
    expect(latestEvent(booking({ reminder: 'reminder_sent' }))).toEqual({
      kind: 'reminderSent',
      tone: 'stone',
    });
    for (const reminder of [
      'not_sent',
      'confirm_requested',
      'reminder_queued',
      'failed',
    ] as const) {
      expect(latestEvent(booking({ reminder }))).toBeNull();
    }
  });

  it('says "Replied Yes" only while the WhatsApp Yes still holds it Confirmed', () => {
    expect(latestEvent(booking({ status: 'confirmed', repliedYes: true }))).toEqual({
      kind: 'repliedYes',
      tone: 'lav',
    });
    expect(latestEvent(booking({ repliedYes: true }))).toBeNull();
  });

  it('counts the moves and keeps the slot it moved from', () => {
    expect(
      latestEvent(booking({ moveCount: 2, rescheduledFrom: '2026-10-02T05:00:00.000Z' })),
    ).toEqual({
      kind: 'moved',
      tone: 'butter',
      times: 2,
      from: '2026-10-02T05:00:00.000Z',
    });
  });

  it('says "Checked in" once the patient has arrived, completed visits included', () => {
    expect(latestEvent(booking({ status: 'checked_in' }))).toEqual({
      kind: 'checkedIn',
      tone: 'mint',
    });
    expect(latestEvent(booking({ status: 'completed' }))?.kind).toBe('checkedIn');
  });

  it('shows the latest: a check-in over a move over a Yes over the reminder', () => {
    const sent = { reminder: 'reminder_sent' as const };
    expect(
      latestEvent(booking({ ...sent, status: 'confirmed', repliedYes: true }))?.kind,
    ).toBe('repliedYes');
    expect(
      latestEvent(
        booking({ ...sent, status: 'confirmed', repliedYes: true, moveCount: 1 }),
      )?.kind,
    ).toBe('moved');
    expect(
      latestEvent(booking({ ...sent, moveCount: 1, status: 'checked_in' }))?.kind,
    ).toBe('checkedIn');
  });
});
