import { describe, expect, it } from 'vitest';

import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';

import {
  agendaGroupLabel,
  dayGroupTone,
  latestEvent,
  latestUpdates,
  serviceTone,
  staffName,
} from './appointments.display.ts';

/** Just the fields the display helpers read. */
function booking(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    status: 'scheduled',
    reminder: null,
    repliedYes: false,
    moveCount: 0,
    rescheduledFrom: null,
    plan: { visit: 0, patient: 0 },
    serviceLabel: 'Consultation',
    type: 'consultation',
    ...overrides,
  } as AppointmentRow;
}

describe('staffName', () => {
  it('writes the name in full, without a missing last name', () => {
    expect(staffName({ firstName: 'Dr. Drashti', lastName: 'Desai' })).toBe(
      'Dr. Drashti Desai',
    );
    expect(staffName({ firstName: 'Meera', lastName: '' })).toBe('Meera');
  });
});

describe('serviceTone', () => {
  it('paints the design’s services by label (AP_SVC, H:3416)', () => {
    expect(serviceTone(booking({ serviceLabel: 'Hydrafacial', type: 'treatment' }))).toBe(
      'mint',
    );
    expect(
      serviceTone(booking({ serviceLabel: 'LHR Treatment', type: 'treatment' })),
    ).toBe('lav');
    expect(serviceTone(booking({ serviceLabel: ' peel ', type: 'treatment' }))).toBe(
      'blush',
    );
  });

  it('falls back to the type’s tone for a service the design does not name', () => {
    expect(
      serviceTone(booking({ serviceLabel: 'Melasma consult', type: 'consultation' })),
    ).toBe('sky');
    expect(
      serviceTone(booking({ serviceLabel: 'Laser session', type: 'package_session' })),
    ).toBe('lav');
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

describe('latestUpdates (H:5971)', () => {
  it('leads with the plan: ready once this visit has suggestions, else pending', () => {
    expect(latestUpdates(booking()).map((pill) => pill.kind)).toEqual(['planPending']);
    expect(latestUpdates(booking({ plan: { visit: 2, patient: 3 } }))).toEqual([
      { kind: 'planReady', tone: 'sage', suggestions: 3 },
    ]);
  });

  it('then the latest event: check-in over a move over a Yes over the reminder', () => {
    const base = { reminder: 'read' as const };
    expect(latestUpdates(booking(base)).at(-1)?.kind).toBe('reminderRead');
    expect(
      latestUpdates(booking({ ...base, status: 'confirmed', repliedYes: true })).at(-1)
        ?.kind,
    ).toBe('repliedYes');
    // A Yes counts only while the booking is Confirmed.
    expect(latestUpdates(booking({ ...base, repliedYes: true })).at(-1)?.kind).toBe(
      'reminderRead',
    );
    expect(
      latestUpdates(
        booking({ ...base, moveCount: 2, rescheduledFrom: '2026-10-02T05:00:00.000Z' }),
      ).at(-1),
    ).toEqual({
      kind: 'moved',
      tone: 'butter',
      times: 2,
      from: '2026-10-02T05:00:00.000Z',
    });
    expect(
      latestUpdates(booking({ ...base, moveCount: 1, status: 'checked_in' })).at(-1)
        ?.kind,
    ).toBe('checkedIn');
  });

  it('words the reminder by its delivery: read, delivered, sent — nothing queued or failed', () => {
    expect(latestEvent(booking({ reminder: 'delivered' }))?.kind).toBe(
      'reminderDelivered',
    );
    expect(latestEvent(booking({ reminder: 'sent' }))?.kind).toBe('reminderSent');
    expect(latestEvent(booking({ reminder: 'queued' }))).toBeNull();
    expect(latestEvent(booking({ reminder: 'failed' }))).toBeNull();
  });

  it('drops the plan for Cancelled and No show, leaving nothing ("—") without events', () => {
    expect(latestUpdates(booking({ status: 'cancelled' }))).toEqual([]);
    expect(latestUpdates(booking({ status: 'no_show', reminder: 'sent' }))).toEqual([
      { kind: 'reminderSent', tone: 'stone' },
    ]);
  });
});
