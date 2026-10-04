import { describe, expect, it } from 'vitest';

import {
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
  const row = (seq: number, date: string, status: AppointmentRow['status']) =>
    ({ seq, date, status }) as AppointmentRow;

  it('groups the rows by day in order, each with its day’s counts from the summary', () => {
    const rows = [
      row(1, '2026-10-03', 'scheduled'),
      row(2, '2026-10-03', 'confirmed'),
      row(3, '2026-10-04', 'confirmed'),
    ];
    const groups = groupAppointmentsByDay(rows, [
      { date: '2026-10-03', total: 2, confirmed: 1, scheduled: 1 },
      // The 4th straddles the next page: its header counts every row, loaded or not.
      { date: '2026-10-04', total: 5, confirmed: 3, scheduled: 2 },
    ]);
    expect(
      groups.map((group) => [group.date, group.rows.map((item) => item.seq)]),
    ).toEqual([
      ['2026-10-03', [1, 2]],
      ['2026-10-04', [3]],
    ]);
    expect(groups[1]?.summary).toEqual({
      date: '2026-10-04',
      total: 5,
      confirmed: 3,
      scheduled: 2,
    });
  });

  it('counts the loaded rows until the summary is in', () => {
    const groups = groupAppointmentsByDay([
      row(1, '2026-10-03', 'scheduled'),
      row(2, '2026-10-03', 'checked_in'),
    ]);
    expect(groups[0]?.summary).toEqual({
      date: '2026-10-03',
      total: 2,
      confirmed: 0,
      scheduled: 1,
    });
    expect(groupAppointmentsByDay([])).toEqual([]);
  });
});
