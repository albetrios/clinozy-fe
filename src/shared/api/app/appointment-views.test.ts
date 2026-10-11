import { describe, expect, it } from 'vitest';

import { dayCount } from '@/tests/utils/appointment-doubles.ts';

import {
  agendaCountsWindow,
  appointmentViewRange,
  groupAppointmentsByDay,
  monthCells,
  monthDays,
} from './appointment-views.ts';
import type { AppointmentRow } from './appointments-contracts.ts';

describe('the month grid (H:5936)', () => {
  it('lays out a month’s days', () => {
    const days = monthDays('2026-02-01');
    expect(days).toHaveLength(28);
    expect(days.at(-1)).toBe('2026-02-28');
    expect(monthDays('2026-12-01').at(-1)).toBe('2026-12-31');
  });

  it('puts the first under its weekday, Sunday first, and fills the last row', () => {
    const cells = monthCells('2026-10-17');
    // 1 Oct 2026 is a Thursday: four blanks before it.
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    expect(cells).toHaveLength(35);
    expect(cells.at(-1)).toBe('2026-10-31');
    // February 2026 starts on a Sunday and fills four rows exactly.
    expect(monthCells('2026-02-01')).toHaveLength(28);
    // August 2026 starts on a Saturday: six rows.
    expect(monthCells('2026-08-01')).toHaveLength(42);
  });
});

describe('appointmentViewRange', () => {
  it('reads one day for Day', () => {
    expect(appointmentViewRange('day', '2026-10-03')).toEqual({
      from: '2026-10-03',
      to: '2026-10-03',
    });
  });

  it('reads Sunday to Saturday for Week (Q-A10), across a month end', () => {
    // 3 Oct 2026 is a Saturday.
    expect(appointmentViewRange('week', '2026-10-03')).toEqual({
      from: '2026-09-27',
      to: '2026-10-03',
    });
    expect(appointmentViewRange('week', '2026-09-27')).toEqual({
      from: '2026-09-27',
      to: '2026-10-03',
    });
    expect(appointmentViewRange('week', '2026-12-31')).toEqual({
      from: '2026-12-27',
      to: '2027-01-02',
    });
  });

  it('reads the calendar month for Month, leap years and December included', () => {
    expect(appointmentViewRange('month', '2026-10-17')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(appointmentViewRange('month', '2028-02-10')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(appointmentViewRange('month', '2026-12-05')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });
});

describe('groupAppointmentsByDay', () => {
  const row = (seq: number, date: string) => ({ seq, date }) as AppointmentRow;

  it('groups the loaded rows by day in the read’s order, each with its day’s counts', () => {
    const rows = [row(1, '2026-10-03'), row(2, '2026-10-03'), row(3, '2026-10-04')];
    // The 4th straddles the next page: its counts are the whole day's, loaded or not.
    const fourth = dayCount('2026-10-04', { scheduled: 2, confirmed: 3 });
    const groups = groupAppointmentsByDay(rows, [
      dayCount('2026-10-03', { scheduled: 1, confirmed: 1 }),
      fourth,
    ]);
    expect(
      groups.map((group) => [group.date, group.rows.map((item) => item.seq)]),
    ).toEqual([
      ['2026-10-03', [1, 2]],
      ['2026-10-04', [3]],
    ]);
    expect(groups[1]?.counts).toEqual(fourth);
  });

  it('never counts the loaded rows itself: a day without the server’s counts has none', () => {
    const groups = groupAppointmentsByDay([row(1, '2026-10-03'), row(2, '2026-10-03')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.counts).toBeUndefined();
    expect(groupAppointmentsByDay([])).toEqual([]);
  });
});

describe('agendaCountsWindow', () => {
  const rows = (...dates: string[]) => dates.map((date) => ({ date }));

  it('covers the loaded rows’ first day to their last', () => {
    expect(agendaCountsWindow(rows('2026-10-03', '2026-10-04', '2026-10-09'))).toEqual({
      from: '2026-10-03',
      to: '2026-10-09',
    });
  });

  it('covers only the day picked in Filters, rows or not', () => {
    expect(agendaCountsWindow(rows('2026-10-05'), '2026-10-05')).toEqual({
      from: '2026-10-05',
      to: '2026-10-05',
    });
    expect(agendaCountsWindow([], '2026-09-28')).toEqual({
      from: '2026-09-28',
      to: '2026-09-28',
    });
  });

  it('stops at the read’s 62 days, and reads nothing before a row has loaded', () => {
    expect(agendaCountsWindow(rows('2026-10-03', '2027-01-20'))).toEqual({
      from: '2026-10-03',
      to: '2026-12-03',
    });
    expect(agendaCountsWindow([])).toBeNull();
  });
});
