import { describe, expect, it } from 'vitest';

import { appInstant } from './app-time.ts';
import { isLeadClosed, leadHold } from './leads-hold.ts';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date(appInstant('2026-10-03', '10:00'));

describe('isLeadClosed', () => {
  it('closes Clinic visited, Not interested, Invalid and Lost — not the four open statuses', () => {
    expect(
      (['clinic_visited', 'not_interested', 'invalid', 'lost'] as const).map((status) =>
        isLeadClosed({ status }),
      ),
    ).toEqual([true, true, true, true]);
    expect(
      (['new', 'contacted', 'follow_up', 'no_response'] as const).map((status) =>
        isLeadClosed({ status }),
      ),
    ).toEqual([false, false, false, false]);
  });
});

describe('leadHold — held_until', () => {
  it('is open without a hold, or once the hold has passed', () => {
    expect(leadHold({ status: 'new', heldUntil: null }, NOW)).toEqual({
      closed: false,
      open: true,
      releasesAt: null,
      releasesToday: false,
      releasesWithinDay: false,
    });
    const passed = appInstant('2026-10-03', '09:59');
    expect(leadHold({ status: 'contacted', heldUntil: passed }, NOW).open).toBe(true);
  });

  it('is held while the hold is ahead, releasing today when it ends before midnight', () => {
    const tonight = appInstant('2026-10-03', '18:00');
    expect(leadHold({ status: 'contacted', heldUntil: tonight }, NOW)).toEqual({
      closed: false,
      open: false,
      releasesAt: tonight,
      releasesToday: true,
      releasesWithinDay: true,
    });
  });

  it('marks a hold ending tomorrow morning within a day but not today', () => {
    const tomorrow = appInstant('2026-10-04', '09:00');
    const hold = leadHold({ status: 'follow_up', heldUntil: tomorrow }, NOW);
    expect([hold.open, hold.releasesToday, hold.releasesWithinDay]).toEqual([
      false,
      false,
      true,
    ]);
    const later = appInstant('2026-10-06', '09:00');
    expect(
      leadHold({ status: 'follow_up', heldUntil: later }, NOW).releasesWithinDay,
    ).toBe(false);
  });

  it('never holds or opens a closed lead', () => {
    const hold = leadHold(
      { status: 'lost', heldUntil: appInstant('2026-10-05', '10:00') },
      NOW,
    );
    expect([hold.closed, hold.open, hold.releasesAt]).toEqual([true, false, null]);
  });
});
