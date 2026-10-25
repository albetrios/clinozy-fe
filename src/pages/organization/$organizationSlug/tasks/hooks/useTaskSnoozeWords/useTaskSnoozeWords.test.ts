import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import { type BranchHours, DEFAULT_BRANCH_HOURS } from '@/shared/app/branch-hours.ts';
import { TASK_RULES_NS } from '@/shared/app/task-rules.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { useTaskSnoozeWords } from './useTaskSnoozeWords.ts';

/** Friday 2 October 2026, 18:00 in the clinic. */
const FRIDAY = new Date(appInstant('2026-10-02', '18:00'));
/** Saturday 3 October 2026, 18:00: Sunday follows. */
const SATURDAY = new Date(appInstant('2026-10-03', '18:00'));

/** A branch that opens at 11:30 and works Tuesday to Saturday. */
const VESU: BranchHours = {
  opensAt: '11:30',
  closesAt: '19:00',
  workingDays: ['tue', 'wed', 'thu', 'fri', 'sat'],
};

const initial = useLocaleStore.getState();

beforeAll(async () => {
  await ensureNamespace('en', TASK_RULES_NS);
});

beforeEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-GB', hourCycle: 'h12' });
});

afterEach(() => {
  cleanup();
  useLocaleStore.setState({
    formatLocale: initial.formatLocale,
    hourCycle: initial.hourCycle,
  });
});

describe('useTaskSnoozeWords', () => {
  it('words the fixed options from the copy', () => {
    const { result } = renderHook(() => useTaskSnoozeWords());
    const at = { now: FRIDAY, hours: DEFAULT_BRANCH_HOURS };
    expect(result.current('oneHour', at)).toBe('1 hour');
    expect(result.current('threeHours', at)).toBe('3 hours');
    expect(result.current('nextWeek', at)).toBe('Next week');
  });

  it('names "Tomorrow" at the branch’s opening time', () => {
    const { result } = renderHook(() => useTaskSnoozeWords());
    const words = (hours: BranchHours) =>
      withoutBidiMarks(result.current('tomorrow', { now: FRIDAY, hours }));
    expect(words(DEFAULT_BRANCH_HOURS)).toMatch(/^Tomorrow 10:00\s?am$/i);
    expect(words(VESU)).toMatch(/^Tomorrow 11:30\s?am$/i);
  });

  it('names the day past a closed one by its date, the one time rule', () => {
    const { result } = renderHook(() => useTaskSnoozeWords());
    const words = (hours: BranchHours) =>
      withoutBidiMarks(result.current('tomorrow', { now: SATURDAY, hours }));
    expect(words(DEFAULT_BRANCH_HOURS)).toMatch(/^5 Oct 10:00\s?am$/i);
    expect(words(VESU)).toMatch(/^6 Oct 11:30\s?am$/i);
  });
});
