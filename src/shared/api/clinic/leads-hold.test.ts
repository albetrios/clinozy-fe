import { describe, expect, it } from 'vitest';

import { clinicInstant } from './clinic-time.ts';
import {
  holdFilterMatches,
  isLeadClosed,
  LEAD_HOLD_DAYS,
  leadHold,
  type LeadHoldSubject,
} from './leads-hold.ts';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date(clinicInstant('2026-10-03', '10:00'));

function subject(overrides: Partial<LeadHoldSubject> = {}): LeadHoldSubject {
  return {
    status: 'contacted',
    patientId: null,
    touchedAt: clinicInstant('2026-10-02', '10:00'),
    releasedAt: null,
    ownerGone: false,
    ...overrides,
  };
}

const hold = (overrides: Partial<LeadHoldSubject> = {}) =>
  leadHold(subject(overrides), LEAD_HOLD_DAYS, NOW);

describe('isLeadClosed', () => {
  it('closes Clinic visited, Not interested, Invalid and Lost, and any lead with a patient', () => {
    for (const status of [
      'clinic_visited',
      'not_interested',
      'invalid',
      'lost',
    ] as const) {
      expect(isLeadClosed({ status, patientId: null }), status).toBe(true);
    }
    for (const status of ['new', 'contacted', 'follow_up', 'no_response'] as const) {
      expect(isLeadClosed({ status, patientId: null }), status).toBe(false);
    }
    expect(isLeadClosed({ status: 'new', patientId: 'patient' })).toBe(true);
  });
});

describe('leadHold (H:3869)', () => {
  it('holds a lead its owner touched yesterday, releasing it three days after the touch', () => {
    expect(hold()).toEqual({
      closed: false,
      ownerGone: false,
      released: false,
      open: false,
      idleDays: 1,
      releasesAt: clinicInstant('2026-10-05', '10:00'),
      releasesToday: false,
      releasesWithinDay: false,
    });
  });

  it('opens once the hold has run out, counting whole idle days', () => {
    const idle = hold({ touchedAt: clinicInstant('2026-09-29', '09:00') });
    expect(idle).toMatchObject({ open: true, idleDays: 4, releasesAt: null });
    // Exactly three days: open on the dot.
    expect(hold({ touchedAt: clinicInstant('2026-09-30', '10:00') }).open).toBe(true);
  });

  it('releases today when the hold runs out later today — the prototype matched tomorrow (§7.3)', () => {
    const today = hold({ touchedAt: clinicInstant('2026-09-30', '16:34') });
    expect(today).toMatchObject({
      open: false,
      releasesToday: true,
      releasesWithinDay: true,
    });
    const tomorrow = hold({ touchedAt: clinicInstant('2026-10-01', '09:30') });
    expect(tomorrow).toMatchObject({
      open: false,
      releasesToday: false,
      releasesWithinDay: true,
    });
    const later = hold({ touchedAt: clinicInstant('2026-10-01', '12:15') });
    expect(later).toMatchObject({ releasesToday: false, releasesWithinDay: false });
  });

  it('opens at once when the owner has left the clinic, or releases it', () => {
    expect(hold({ ownerGone: true })).toMatchObject({ open: true, ownerGone: true });
    expect(hold({ releasedAt: clinicInstant('2026-10-03', '09:00') })).toMatchObject({
      open: true,
      released: true,
    });
  });

  it('holds again once the owner touches it after releasing', () => {
    const touchedAgain = hold({
      releasedAt: clinicInstant('2026-10-02', '09:00'),
      touchedAt: clinicInstant('2026-10-02', '10:00'),
    });
    expect(touchedAgain).toMatchObject({ released: false, open: false });
  });

  it('never releases a closed lead, however idle or whoever owns it', () => {
    const closed = hold({
      status: 'clinic_visited',
      touchedAt: clinicInstant('2026-08-01', '10:00'),
      ownerGone: true,
    });
    expect(closed).toMatchObject({ closed: true, open: false, releasesAt: null });
    expect(hold({ patientId: 'patient' }).closed).toBe(true);
  });

  it('reads the org hold days', () => {
    const touchedAt = clinicInstant('2026-10-01', '10:00');
    expect(leadHold(subject({ touchedAt }), 1, NOW).open).toBe(true);
    expect(leadHold(subject({ touchedAt }), 7, NOW).open).toBe(false);
  });
});

describe('holdFilterMatches — the Ownership filter', () => {
  const open = hold({ ownerGone: true });
  const releasingToday = hold({ touchedAt: clinicInstant('2026-09-30', '16:34') });
  const held = hold();
  const closed = hold({ status: 'lost' });

  it('"Open to claim" is the open leads', () => {
    expect(
      [open, releasingToday, held, closed].map((h) => holdFilterMatches(h, 'open')),
    ).toEqual([true, false, false, false]);
  });

  it('"Releasing today" is the held leads that open later today', () => {
    expect(
      [open, releasingToday, held, closed].map((h) => holdFilterMatches(h, 'soon')),
    ).toEqual([false, true, false, false]);
  });

  it('"Held" is every lead its owner still holds, releasing today included', () => {
    expect(
      [open, releasingToday, held, closed].map((h) => holdFilterMatches(h, 'held')),
    ).toEqual([false, true, true, false]);
  });
});
