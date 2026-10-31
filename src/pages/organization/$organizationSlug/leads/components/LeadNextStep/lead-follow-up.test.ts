import { describe, expect, it } from 'vitest';

import { appInstant } from '@/shared/api/app/app-time.ts';

import {
  followUpInstant,
  followUpPartsOf,
  followUpPicks,
  nextTryAt,
  winBackUntil,
} from './lead-follow-up.ts';

/** 10:00 on Sat 3 Oct 2026, clinic time. */
const MORNING = new Date(appInstant('2026-10-03', '10:00'));
/** 18:30 the same day. */
const EVENING = new Date(appInstant('2026-10-03', '18:30'));

describe('the follow-up time (D25)', () => {
  it('keeps a follow-up still ahead, else starts tomorrow at 11:00', () => {
    expect(followUpPartsOf(appInstant('2026-10-05', '18:00'), MORNING)).toEqual({
      date: '2026-10-05',
      time: '18:00',
    });
    expect(followUpPartsOf(appInstant('2026-10-02', '18:00'), MORNING)).toEqual({
      date: '2026-10-04',
      time: '11:00',
    });
    expect(followUpPartsOf(null, MORNING)).toEqual({ date: '2026-10-04', time: '11:00' });
  });

  it('turns a day and clock into the instant the server stores', () => {
    expect(followUpInstant({ date: '2026-10-04', time: '11:00' })).toBe(
      appInstant('2026-10-04', '11:00'),
    );
  });

  it('No answer tries again tomorrow at the same clock, 11:00 without one', () => {
    expect(nextTryAt(appInstant('2026-10-03', '18:00'), MORNING)).toBe(
      appInstant('2026-10-04', '18:00'),
    );
    expect(nextTryAt(null, MORNING)).toBe(appInstant('2026-10-04', '11:00'));
  });

  it('offers Later today only while 5 pm is ahead', () => {
    expect(followUpPicks(MORNING).map((pick) => pick.id)).toEqual([
      'laterToday',
      'tomorrow',
      'inThreeDays',
      'nextWeek',
    ]);
    expect(followUpPicks(MORNING)[0]?.parts).toEqual({
      date: '2026-10-03',
      time: '17:00',
    });
    expect(followUpPicks(EVENING).map((pick) => pick.id)).toEqual([
      'tomorrow',
      'inThreeDays',
      'nextWeek',
    ]);
    expect(followUpPicks(EVENING).at(-1)?.parts).toEqual({
      date: '2026-10-10',
      time: '11:00',
    });
  });

  it('wins a closed lead back until 90 days after it closed (clinozy-be D2)', () => {
    expect(winBackUntil(appInstant('2026-10-03', '16:00'))).toBe('2027-01-01');
  });
});
