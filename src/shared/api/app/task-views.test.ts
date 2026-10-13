import { describe, expect, it } from 'vitest';

import {
  groupTasks,
  isTaskOverdue,
  TASK_GROUP_TONES,
  taskDueAt,
  taskDueLabel,
} from './task-views.ts';

/** 10:30 in the clinic (Asia/Kolkata, UTC+05:30) on Sun 4 Oct 2026. */
const NOW = new Date('2026-10-04T05:00:00.000Z');
const minutesFromNow = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000).toISOString();

function task(
  dueAt: string,
  overrides: Partial<{
    id: string;
    status: 'open' | 'snoozed' | 'done';
    snoozeLabel: string | null;
    isResolvedAutomatically: boolean;
    resolvedAt: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? dueAt,
    status: overrides.status ?? 'open',
    dueAt,
    snoozeLabel: overrides.snoozeLabel ?? null,
    isResolvedAutomatically: overrides.isResolvedAutomatically ?? false,
    resolvedAt: overrides.resolvedAt ?? null,
  } as const;
}

describe('taskDueLabel (tasks.md:58, H:4219)', () => {
  it('counts minutes, hours, then days overdue', () => {
    expect(taskDueLabel(task(minutesFromNow(-1)), NOW)).toEqual({
      kind: 'overdue',
      unit: 'minutes',
      count: 1,
    });
    expect(taskDueLabel(task(minutesFromNow(-59)), NOW)).toMatchObject({
      unit: 'minutes',
      count: 59,
    });
    expect(taskDueLabel(task(minutesFromNow(-60)), NOW)).toMatchObject({
      unit: 'hours',
      count: 1,
    });
    // Hours round: 89 min is "1 h", 90 min "2 h" (Math.round, as the prototype).
    expect(taskDueLabel(task(minutesFromNow(-89)), NOW)).toMatchObject({ count: 1 });
    expect(taskDueLabel(task(minutesFromNow(-90)), NOW)).toMatchObject({ count: 2 });
    expect(taskDueLabel(task(minutesFromNow(-1439)), NOW)).toMatchObject({
      unit: 'hours',
      count: 24,
    });
    expect(taskDueLabel(task(minutesFromNow(-1440)), NOW)).toEqual({
      kind: 'overdue',
      unit: 'days',
      count: 1,
    });
    expect(taskDueLabel(task(minutesFromNow(-3 * 1440)), NOW)).toMatchObject({
      unit: 'days',
      count: 3,
    });
  });

  it('reads "in <n>" up to 12 hours ahead, minutes then hours', () => {
    expect(taskDueLabel(task(minutesFromNow(0)), NOW)).toEqual({
      kind: 'soon',
      unit: 'minutes',
      count: 0,
    });
    expect(taskDueLabel(task(minutesFromNow(40)), NOW)).toEqual({
      kind: 'soon',
      unit: 'minutes',
      count: 40,
    });
    expect(taskDueLabel(task(minutesFromNow(180)), NOW)).toEqual({
      kind: 'soon',
      unit: 'hours',
      count: 3,
    });
    expect(taskDueLabel(task(minutesFromNow(720)), NOW)).toEqual({
      kind: 'soon',
      unit: 'hours',
      count: 12,
    });
  });

  it('names the clinic-local day and time beyond 12 hours', () => {
    // 22:31 tonight in the clinic is still today.
    expect(taskDueLabel(task(minutesFromNow(721)), NOW)).toEqual({
      kind: 'at',
      date: '2026-10-04',
      time: '22:31',
    });
    // 11:00 tomorrow, clinic-local (05:30 UTC).
    expect(taskDueLabel(task('2026-10-05T05:30:00.000Z'), NOW)).toEqual({
      kind: 'at',
      date: '2026-10-05',
      time: '11:00',
    });
    // 00:30 on 7 Oct in the clinic is still 6 Oct in UTC.
    expect(taskDueLabel(task('2026-10-06T19:00:00.000Z'), NOW)).toEqual({
      kind: 'at',
      date: '2026-10-07',
      time: '00:30',
    });
  });

  it('reads a snoozed task’s snooze and a done task’s closer', () => {
    expect(
      taskDueLabel(
        task(minutesFromNow(-30), { status: 'snoozed', snoozeLabel: '2 h · no answer' }),
        NOW,
      ),
    ).toEqual({ kind: 'snoozed', label: '2 h · no answer' });
    expect(
      taskDueLabel(
        task(minutesFromNow(-30), { status: 'done', isResolvedAutomatically: true }),
        NOW,
      ),
    ).toEqual({ kind: 'doneByClinozy' });
    const at = minutesFromNow(-5);
    expect(
      taskDueLabel(
        task(minutesFromNow(-30), {
          status: 'done',
          isResolvedAutomatically: false,
          resolvedAt: at,
        }),
        NOW,
      ),
    ).toEqual({ kind: 'done', at });
  });
});

describe('isTaskOverdue', () => {
  it('is an open task past its due time — never a snoozed or done one', () => {
    expect(isTaskOverdue(task(minutesFromNow(-1)), NOW)).toBe(true);
    expect(isTaskOverdue(task(minutesFromNow(0)), NOW)).toBe(false);
    expect(isTaskOverdue(task(minutesFromNow(-1), { status: 'snoozed' }), NOW)).toBe(
      false,
    );
    expect(isTaskOverdue(task(minutesFromNow(-1), { status: 'done' }), NOW)).toBe(false);
  });
});

describe('groupTasks (tasks.md:19, 30)', () => {
  it('splits To do into Overdue · Due today · Coming up, each by due time', () => {
    const rows = [
      task('2026-10-05T05:30:00.000Z', { id: 'tomorrow' }),
      task(minutesFromNow(30), { id: 'soon' }),
      task(minutesFromNow(-10), { id: 'late' }),
      task(minutesFromNow(-120), { id: 'later-late' }),
      task(minutesFromNow(5), { id: 'sooner' }),
    ];
    const groups = groupTasks(rows, 'open', NOW);
    expect(groups.map((group) => group.id)).toEqual(['overdue', 'today', 'later']);
    expect(groups.map((group) => group.rows.map((row) => row.id))).toEqual([
      ['later-late', 'late'],
      ['sooner', 'soon'],
      ['tomorrow'],
    ]);
  });

  it('leaves an empty To do group out, and nothing at all when To do is empty', () => {
    expect(
      groupTasks([task(minutesFromNow(60))], 'open', NOW).map((group) => group.id),
    ).toEqual(['today']);
    expect(groupTasks([], 'open', NOW)).toEqual([]);
  });

  it('keeps Snoozed and Done as one group each, even empty', () => {
    expect(groupTasks([], 'snoozed', NOW)).toEqual([{ id: 'snoozed', rows: [] }]);
    const done = [task(minutesFromNow(-5), { status: 'done' })];
    expect(groupTasks(done, 'done', NOW)).toEqual([{ id: 'done', rows: done }]);
  });

  it('tones To do’s squares and draws none for Snoozed and Resolved', () => {
    expect(TASK_GROUP_TONES).toEqual({
      overdue: 'blush',
      today: 'butter',
      later: 'sky',
      snoozed: null,
      done: null,
    });
  });
});

describe('taskDueAt', () => {
  it('carries a picked clinic-local day and time — the clock words them', () => {
    expect(taskDueAt('2026-10-04', '17:00')).toEqual({
      kind: 'at',
      date: '2026-10-04',
      time: '17:00',
    });
  });
});
