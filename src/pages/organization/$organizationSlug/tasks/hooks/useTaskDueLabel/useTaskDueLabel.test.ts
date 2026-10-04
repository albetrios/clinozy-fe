import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  type TaskDueLabelInput,
  useTaskDueAtWords,
  useTaskDueLabel,
} from './useTaskDueLabel.ts';

/** 10:30 in the clinic (Asia/Kolkata) on Sun 4 Oct 2026. */
const NOW = new Date('2026-10-04T05:00:00.000Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const open = (dueAt: string): TaskDueLabelInput => ({
  status: 'open',
  dueAt,
  snoozeLabel: null,
  resolvedBy: null,
  resolvedAt: null,
});

function label(task: TaskDueLabelInput): string {
  const { result } = renderHook(() => useTaskDueLabel());
  return result.current(task, NOW);
}

const initialHourCycle = useLocaleStore.getState().hourCycle;
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('useTaskDueLabel (tasks.md:58, 309)', () => {
  it('says how late an overdue task is — minutes, hours, days', () => {
    expect(label(open(at(-40)))).toBe('40 min overdue');
    expect(label(open(at(-150)))).toBe('3 h overdue');
    expect(label(open(at(-2 * 1440)))).toBe('2 d overdue');
  });

  it('counts down within 12 hours', () => {
    expect(label(open(at(25)))).toBe('in 25 min');
    expect(label(open(at(5 * 60)))).toBe('in 5 h');
  });

  it('names the clinic day and the time beyond that, in the Appearance hour cycle', () => {
    useLocaleStore.setState({ hourCycle: 'h12' });
    expect(label(open('2026-10-05T05:30:00.000Z'))).toMatch(/^Tomorrow 11:00\s?am$/i);
    // The day reads in the viewer's format locale ("Wed, Oct 7" in en-US, "Wed 7 Oct" in en-GB).
    expect(label(open('2026-10-07T10:00:00.000Z'))).toMatch(
      /^Wed,? (Oct 7|7 Oct) 3:30\s?pm$/i,
    );
    useLocaleStore.setState({ hourCycle: 'h23' });
    expect(label(open('2026-10-05T12:30:00.000Z'))).toBe('Tomorrow 18:00');
  });

  it('reads a snooze, a close by the product, and a member’s close — "Now" for a minute', () => {
    useLocaleStore.setState({ hourCycle: 'h23' });
    expect(
      label({ ...open(at(-30)), status: 'snoozed', snoozeLabel: '2 h · no answer' }),
    ).toBe('Snoozed · 2 h · no answer');
    expect(label({ ...open(at(-30)), status: 'done', resolvedBy: 'clinozy' })).toBe(
      `Done by ${PRODUCT_NAME}`,
    );
    expect(
      label({
        ...open(at(-30)),
        status: 'done',
        resolvedBy: 'member',
        resolvedAt: at(0),
      }),
    ).toBe('Done · Now');
    expect(
      label({
        ...open(at(-30)),
        status: 'done',
        resolvedBy: 'member',
        resolvedAt: at(-90),
      }),
    ).toBe('Done · 09:00');
  });
});

describe('useTaskDueAtWords', () => {
  it('words a picked day and time the way the due label does', () => {
    useLocaleStore.setState({ hourCycle: 'h23' });
    const { result } = renderHook(() => useTaskDueAtWords());
    expect(result.current('2026-10-04', '17:00', NOW)).toBe('Today 17:00');
    expect(result.current('2026-10-05', '11:00', NOW)).toBe('Tomorrow 11:00');
    expect(result.current('2026-10-07', '15:30', NOW)).toMatch(
      /^Wed,? (Oct 7|7 Oct) 15:30$/,
    );
  });
});
