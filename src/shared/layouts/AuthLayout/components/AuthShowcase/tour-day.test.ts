import { describe, expect, it } from 'vitest';

import {
  addMinutes,
  buildTourDay,
  TOUR_CLOSES_AT_HOUR,
  TOUR_OPENS_AT_HOUR,
} from './tour-day.ts';

/** A local moment: 24 October 2026 is a Saturday. */
function at(hours: number, minutes: number, day = 24): Date {
  return new Date(2026, 9, day, hours, minutes, 37);
}

describe('buildTourDay', () => {
  it('in clinic hours: today, the row before Riya’s at the last quarter hour, hers the next', () => {
    const day = buildTourDay(at(17, 22));
    expect(day.open).toBe(true);
    expect(day.base).toEqual(new Date(2026, 9, 24, 17, 15, 0, 0));
    expect(day.slot).toEqual(new Date(2026, 9, 24, 17, 30, 0, 0));
  });

  it('after closing: tomorrow from 10:30, and Riya books into it', () => {
    const day = buildTourDay(at(22, 40));
    expect(day.open).toBe(false);
    expect(day.base).toEqual(new Date(2026, 9, 25, 10, 30, 0, 0));
    expect(day.slot).toEqual(new Date(2026, 9, 25, 10, 45, 0, 0));
  });

  it('before opening: this morning from 10:30', () => {
    const day = buildTourDay(at(6, 5));
    expect(day.open).toBe(false);
    expect(day.base).toEqual(new Date(2026, 9, 24, 10, 30, 0, 0));
  });

  it('opens and closes on the hour', () => {
    expect(buildTourDay(at(TOUR_OPENS_AT_HOUR, 0)).open).toBe(true);
    expect(buildTourDay(at(TOUR_CLOSES_AT_HOUR - 1, 59)).open).toBe(true);
    expect(buildTourDay(at(TOUR_CLOSES_AT_HOUR, 0)).open).toBe(false);
  });

  it('sets the follow-up for the next Tuesday — a week on when today is Tuesday', () => {
    expect(buildTourDay(at(12, 0)).followUp.getDate()).toBe(27);
    const tuesday = buildTourDay(at(12, 0, 27));
    expect(tuesday.followUp.getDate()).toBe(3);
    expect(tuesday.followUp.getMonth()).toBe(10);
  });

  it('books the next session three weeks on', () => {
    const day = buildTourDay(at(12, 0));
    expect(day.nextSession).toEqual(addMinutes(day.base, 21 * 24 * 60));
  });
});
