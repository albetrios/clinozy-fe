import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type BranchHours,
  branchHoursOf,
  DEFAULT_BRANCH_HOURS,
  isBranchWorkingDay,
  nextBranchWorkingDay,
  rememberBranchHours,
  REMEMBERED_BRANCH_HOURS_KEY,
  rememberedBranchHours,
} from './branch-hours.ts';

const VESU: BranchHours = {
  opensAt: '09:30',
  closesAt: '18:00',
  workingDays: ['tue', 'wed', 'thu', 'fri', 'sat'],
};

describe('branch working days', () => {
  it('starts a branch at Monday to Saturday, 10:00–20:00 (F18)', () => {
    expect(DEFAULT_BRANCH_HOURS).toEqual({
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      opensAt: '10:00',
      closesAt: '20:00',
    });
  });

  it('reads whether a calendar date is a working day', () => {
    // 2026-10-25 is a Sunday, 2026-10-26 a Monday.
    expect(isBranchWorkingDay(DEFAULT_BRANCH_HOURS, '2026-10-25')).toBe(false);
    expect(isBranchWorkingDay(DEFAULT_BRANCH_HOURS, '2026-10-26')).toBe(true);
    expect(isBranchWorkingDay(VESU, '2026-10-26')).toBe(false);
  });

  it('finds the next working day on or after a date', () => {
    expect(nextBranchWorkingDay(DEFAULT_BRANCH_HOURS, '2026-10-24')).toBe('2026-10-24');
    expect(nextBranchWorkingDay(DEFAULT_BRANCH_HOURS, '2026-10-25')).toBe('2026-10-26');
    expect(nextBranchWorkingDay(VESU, '2026-10-25')).toBe('2026-10-27');
    expect(nextBranchWorkingDay(VESU, '2026-10-31')).toBe('2026-10-31');
  });

  it('answers the date itself for a branch with no working days', () => {
    expect(nextBranchWorkingDay({ ...VESU, workingDays: [] }, '2026-10-25')).toBe(
      '2026-10-25',
    );
  });

  it('keeps only the hours of a record that carries more', () => {
    const branch = { ...VESU, id: 'brn_vesu', name: 'Vesu' };
    expect(branchHoursOf(branch)).toEqual(VESU);
  });
});

describe('this device’s branch hours', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads the default hours on a first visit', () => {
    expect(rememberedBranchHours()).toEqual(DEFAULT_BRANCH_HOURS);
  });

  it('keeps the hours alone and reads them back', () => {
    rememberBranchHours({ ...VESU, id: 'brn_vesu', name: 'Vesu' } as BranchHours);
    expect(JSON.parse(localStorage.getItem(REMEMBERED_BRANCH_HOURS_KEY) ?? '')).toEqual(
      VESU,
    );
    expect(rememberedBranchHours()).toEqual(VESU);
  });

  it('falls back to the default for a value that no longer reads', () => {
    const stored = [
      'not json',
      '{"opensAt":"9:30","closesAt":"18:00","workingDays":["mon"]}',
      '{"opensAt":"18:00","closesAt":"09:30","workingDays":["mon"]}',
      '{"opensAt":"09:30","closesAt":"18:00","workingDays":[]}',
      '{"opensAt":"09:30","closesAt":"18:00","workingDays":["funday"]}',
      'null',
    ];
    for (const value of stored) {
      localStorage.setItem(REMEMBERED_BRANCH_HOURS_KEY, value);
      expect(rememberedBranchHours()).toEqual(DEFAULT_BRANCH_HOURS);
    }
  });

  it('reads the days in week order', () => {
    localStorage.setItem(
      REMEMBERED_BRANCH_HOURS_KEY,
      '{"opensAt":"09:30","closesAt":"18:00","workingDays":["sat","tue"]}',
    );
    expect(rememberedBranchHours().workingDays).toEqual(['tue', 'sat']);
  });

  it('keeps going when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => rememberBranchHours(VESU)).not.toThrow();
    expect(rememberedBranchHours()).toEqual(DEFAULT_BRANCH_HOURS);
  });
});
