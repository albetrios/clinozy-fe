import { describe, expect, it } from 'vitest';

import { type BranchHours, DEFAULT_BRANCH_HOURS } from '@/shared/app/branch-hours.ts';

import { addMinutes, buildTourDay, isInTourHours, tourBranchState } from './tour-day.ts';

/** A local moment: 24 October 2026 is a Saturday, the 25th a Sunday. */
function at(hours: number, minutes: number, day = 24): Date {
  return new Date(2026, 9, day, hours, minutes, 37);
}

/** A local moment on the hour, seconds clear. */
const on = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 9, day, hours, minutes, 0, 0);

/** A branch that opens late and works Tuesday to Saturday. */
const VESU: BranchHours = {
  opensAt: '11:00',
  closesAt: '19:00',
  workingDays: ['tue', 'wed', 'thu', 'fri', 'sat'],
};

describe('buildTourDay', () => {
  it('in clinic hours: today, the row before Riya’s at the last quarter hour, hers the next', () => {
    const day = buildTourDay(at(17, 22), DEFAULT_BRANCH_HOURS);
    expect(day.open).toBe(true);
    expect(day.sheetDay).toBe('today');
    expect(day.base).toEqual(on(24, 17, 15));
    expect(day.slot).toEqual(on(24, 17, 30));
    expect(day.opens).toEqual(on(24, 10));
    expect(day.closes).toEqual(on(24, 20));
  });

  it('opens at the branch’s opening and stays open while Riya’s slot ends by closing', () => {
    expect(buildTourDay(at(9, 59), DEFAULT_BRANCH_HOURS).open).toBe(false);
    expect(buildTourDay(at(10, 0), DEFAULT_BRANCH_HOURS).open).toBe(true);
    // 19:44: Riya's 19:30 slot ends at 19:45 — the 19:45 one would end at closing.
    expect(buildTourDay(at(19, 44), DEFAULT_BRANCH_HOURS).open).toBe(true);
    expect(buildTourDay(at(19, 45), DEFAULT_BRANCH_HOURS).open).toBe(false);
  });

  it('after closing: the next working day from a quarter hour after opening, Riya booking into it', () => {
    // Saturday night: Sunday is closed, so the sheet is Monday's.
    const day = buildTourDay(at(22, 40), DEFAULT_BRANCH_HOURS);
    expect(day.open).toBe(false);
    expect(day.sheetDay).toBe('later');
    expect(day.base).toEqual(on(26, 10, 15));
    expect(day.slot).toEqual(on(26, 10, 30));
    expect(day.opens).toEqual(on(26, 10));
  });

  it('reads tomorrow when the next working day is tomorrow', () => {
    const day = buildTourDay(at(21, 5, 23), DEFAULT_BRANCH_HOURS);
    expect(day.sheetDay).toBe('tomorrow');
    expect(day.base).toEqual(on(24, 10, 15));
  });

  it('before opening on a working day: this morning’s sheet, not yet open', () => {
    const day = buildTourDay(at(6, 5), DEFAULT_BRANCH_HOURS);
    expect(day.open).toBe(false);
    expect(day.sheetDay).toBe('today');
    expect(day.base).toEqual(on(24, 10, 15));
  });

  it('on a closed day: the next opening, in the branch’s own hours', () => {
    // Sunday noon, a Tuesday-to-Saturday branch: Tuesday at 11:00.
    const day = buildTourDay(at(12, 0, 25), VESU);
    expect(day.open).toBe(false);
    expect(day.sheetDay).toBe('later');
    expect(day.opens).toEqual(on(27, 11));
    expect(day.slot).toEqual(on(27, 11, 30));
    expect(day.closes).toEqual(on(27, 19));
  });

  it('draws only the visits inside the sheet day’s hours', () => {
    const day = buildTourDay(at(10, 5), DEFAULT_BRANCH_HOURS);
    expect(isInTourHours(day, addMinutes(day.base, -15))).toBe(false);
    expect(isInTourHours(day, day.base)).toBe(true);
    const late = buildTourDay(at(19, 20), DEFAULT_BRANCH_HOURS);
    expect(isInTourHours(late, addMinutes(late.base, 30))).toBe(true);
    expect(isInTourHours(late, addMinutes(late.base, 45))).toBe(false);
  });

  it('sets the follow-up on the first working day three or more days after her visit', () => {
    // Saturday's visit → Tuesday; a closed Sunday would push it on.
    expect(buildTourDay(at(12, 0), DEFAULT_BRANCH_HOURS).followUp.getDate()).toBe(27);
    // Thursday's visit → Sunday is closed, so Monday.
    expect(buildTourDay(at(12, 0, 22), DEFAULT_BRANCH_HOURS).followUp.getDate()).toBe(26);
  });

  it('books the next session three weeks on, at her slot’s time', () => {
    const day = buildTourDay(at(12, 0), DEFAULT_BRANCH_HOURS);
    expect(day.nextSession).toEqual(new Date(2026, 10, 14, 12, 15));
  });
});

describe('tourBranchState', () => {
  it('reads a branch open until its close', () => {
    expect(tourBranchState(DEFAULT_BRANCH_HOURS, at(17, 22))).toEqual({
      kind: 'open',
      closes: on(24, 20),
    });
  });

  it('reads a branch that opens later today', () => {
    expect(tourBranchState(VESU, at(9, 30))).toEqual({
      kind: 'opensToday',
      opens: on(24, 11),
    });
  });

  it('reads a closed branch by its next working day: tomorrow, or a later one', () => {
    // Friday night: Saturday works.
    expect(tourBranchState(DEFAULT_BRANCH_HOURS, at(21, 0, 23))).toEqual({
      kind: 'opensTomorrow',
      opens: on(24, 10),
    });
    // Saturday night: Sunday is closed, so Monday.
    expect(tourBranchState(DEFAULT_BRANCH_HOURS, at(20, 0))).toEqual({
      kind: 'opensLater',
      opens: on(26, 10),
    });
    // Sunday noon, a Tuesday-to-Saturday branch: Tuesday.
    expect(tourBranchState(VESU, at(12, 0, 25))).toEqual({
      kind: 'opensLater',
      opens: on(27, 11),
    });
  });
});
