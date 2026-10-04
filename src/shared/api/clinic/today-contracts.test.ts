import { describe, expect, it } from 'vitest';

import { todayLaneOf } from './today-contracts.ts';

const VISIT = '00000000-0000-4000-8000-000000000009';
const RX = {
  id: '00000000-0000-4000-8000-000000000008',
  approvedAt: '2026-10-03T04:35:00.000Z',
  items: 3,
};
const at = '2026-10-03T05:00:00.000Z';

describe('todayLaneOf (KICKOFF §6.2 Stage machine; D20)', () => {
  it('puts a booking not yet checked in in Arriving', () => {
    expect(todayLaneOf({ status: 'scheduled', visit: null, prescription: null })).toBe(
      'arriving',
    );
    expect(todayLaneOf({ status: 'confirmed', visit: null, prescription: null })).toBe(
      'arriving',
    );
  });

  it('puts a checked-in booking in its visit’s stage — Waiting before the first move', () => {
    expect(todayLaneOf({ status: 'checked_in', visit: null, prescription: null })).toBe(
      'waiting',
    );
    for (const stage of [
      'waiting',
      'with_doctor',
      'treatment',
      'checkout',
      'pharmacy',
    ] as const) {
      expect(
        todayLaneOf({
          status: 'checked_in',
          visit: { id: VISIT, stage, stageAt: at },
          prescription: null,
        }),
      ).toBe(stage);
    }
    expect(
      todayLaneOf({
        status: 'checked_in',
        visit: { id: VISIT, stage: 'done', stageAt: at },
        prescription: null,
      }),
    ).toBeNull();
  });

  it('keeps a completed visit at the pharmacy while its Rx waits, then lets it go', () => {
    expect(todayLaneOf({ status: 'completed', visit: null, prescription: RX })).toBe(
      'pharmacy',
    );
    expect(
      todayLaneOf({ status: 'completed', visit: null, prescription: null }),
    ).toBeNull();
    expect(
      todayLaneOf({
        status: 'completed',
        visit: { id: VISIT, stage: 'done', stageAt: at },
        prescription: RX,
      }),
    ).toBeNull();
  });

  it('leaves cancelled and no-show bookings off the floor', () => {
    expect(
      todayLaneOf({ status: 'cancelled', visit: null, prescription: null }),
    ).toBeNull();
    expect(
      todayLaneOf({ status: 'no_show', visit: null, prescription: null }),
    ).toBeNull();
  });
});
