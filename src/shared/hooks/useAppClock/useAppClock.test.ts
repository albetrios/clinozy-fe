import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { addCivilDays, appToday } from '@/shared/api/app/app-time.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import {
  appClockOf,
  type AppClockParts,
  type AppClockWords,
  appWallClock,
  useAppClock,
} from './useAppClock.ts';

/** A clock whose parts show what they were asked, so the rule's choices read plainly. */
const parts: AppClockParts = {
  today: '2026-10-05',
  appToday: '2026-10-05',
  dayOf: (instant) => instant.slice(0, 10),
  time: (instant) => instant.slice(11, 16),
  shortTime: () => '10 am',
  date: (date) => `date ${date}`,
  wallTime: (_date, time) => `w${time}`,
};

const words: AppClockWords = {
  today: 'Today',
  yesterday: 'Yesterday',
  tomorrow: 'Tomorrow',
  weekday: (date) => `weekday ${date}`,
  todayTime: (time) => `Today ${time}`,
  dayTime: (day, time) => `${day} ${time}`,
};

describe('appClockOf — the one time rule', () => {
  const clock = appClockOf(parts, words);

  it.each([
    ['2026-10-05T10:30', 'Today 10:30'],
    ['2026-10-04T09:10', 'Yesterday 09:10'],
    ['2026-10-02T16:00', 'weekday 2026-10-02 16:00'],
    ['2026-09-29T16:00', 'weekday 2026-09-29 16:00'],
    ['2026-09-28T16:00', 'date 2026-09-28 16:00'],
    ['2025-12-24T16:00', 'date 2025-12-24 16:00'],
    ['2026-10-06T11:00', 'Tomorrow 11:00'],
    ['2026-10-09T16:00', 'date 2026-10-09 16:00'],
  ])('reads the moment %s as "%s"', (instant, label) => {
    expect(clock.moment(instant)).toBe(label);
  });

  it('names the day alone where the room shows days — today too', () => {
    expect(clock.moment('2026-10-05T10:30', { withTime: false })).toBe('Today');
    expect(clock.moment('2026-10-04T09:10', { withTime: false })).toBe('Yesterday');
    expect(clock.moment('2026-10-02T16:00', { withTime: false })).toBe(
      'weekday 2026-10-02',
    );
    expect(clock.moment('2026-10-09T16:00', { withTime: false })).toBe('date 2026-10-09');
  });

  it('gives today its bare time only where the context already is that day', () => {
    expect(clock.moment('2026-10-05T10:30', { sameDay: true })).toBe('10:30');
    expect(clock.moment('2026-10-04T09:10', { sameDay: true })).toBe('Yesterday 09:10');
    expect(clock.wallMoment('2026-10-05', '15:30', { sameDay: true })).toBe('w15:30');
  });

  it('names a calendar date by the same rule, today in words', () => {
    expect(clock.day('2026-10-05')).toBe('Today');
    expect(clock.day('2026-10-04')).toBe('Yesterday');
    expect(clock.day('2026-09-30')).toBe('weekday 2026-09-30');
    expect(clock.day('2026-09-20')).toBe('date 2026-09-20');
    expect(clock.day('2026-10-06')).toBe('Tomorrow');
    expect(clock.day('2026-10-12')).toBe('date 2026-10-12');
  });

  it('reads from the `now` a list keeps, not from when the clock was made', () => {
    // A day later, Monday's 10:30 is yesterday's.
    const tuesday = new Date('2026-10-06T06:00:00.000Z');
    expect(clock.moment('2026-10-05T10:30', { now: tuesday })).toBe('Yesterday 10:30');
    expect(clock.day('2026-10-05', tuesday)).toBe('Yesterday');
    // The clinic's own day of `now` (Asia/Kolkata): 20:00 UTC on the 5th is the 6th there.
    const lateMonday = new Date('2026-10-05T20:00:00.000Z');
    expect(clock.wallDay('2026-10-06', lateMonday)).toBe('Today');
    expect(clock.wallMoment('2026-10-06', '09:00', { now: lateMonday })).toBe(
      'Today w09:00',
    );
  });

  it('reads a wall-clock day and time against the clinic’s own today', () => {
    const viewerAhead = appClockOf({ ...parts, today: '2026-10-06' }, words);
    expect(viewerAhead.wallMoment('2026-10-05', '15:30')).toBe('Today w15:30');
    expect(viewerAhead.wallMoment('2026-10-06', '09:00')).toBe('Tomorrow w09:00');
    expect(viewerAhead.wallMoment('2026-10-06', '09:00', { withTime: false })).toBe(
      'Tomorrow',
    );
    expect(viewerAhead.wallDay('2026-10-05')).toBe('Today');
    expect(viewerAhead.day('2026-10-05')).toBe('Yesterday');
  });
});

describe('appWallClock', () => {
  it('holds the clinic-local day and time as its own fields', () => {
    const wall = appWallClock('2026-10-03', '15:30');
    expect([wall.getFullYear(), wall.getMonth(), wall.getDate()]).toEqual([2026, 9, 3]);
    expect([wall.getHours(), wall.getMinutes()]).toEqual([15, 30]);
  });
});

/**
 * ICU spaces a 12-hour "am" with U+202F; read every space as one — and drop
 * the time's isolate marks (their own test below).
 */
const plain = (text: string) => withoutBidiMarks(text).replace(/\s/gu, ' ');

const initial = useLocaleStore.getState();

describe('useAppClock', () => {
  afterEach(async () => {
    // Unmount first, so the language and prefs going back re-render nothing.
    cleanup();
    vi.useRealTimers();
    useLocaleStore.setState({
      locale: initial.locale,
      formatLocale: initial.formatLocale,
      hourCycle: initial.hourCycle,
      timeZone: initial.timeZone,
    });
    await i18n.changeLanguage('en');
  });

  it('reads today on the clinic calendar and dates other days', () => {
    const { result } = renderHook(() => useAppClock());
    const today = appToday();
    expect(result.current.today).toBe(today);
    expect(result.current.dayOf(new Date().toISOString())).toBe(today);
    expect(result.current.date(addCivilDays(today, -9))).toMatch(/\d/);
    expect(result.current.time(new Date().toISOString())).toMatch(/\d/);
  });

  it('words a clinic-local wall-clock time in the viewer’s hour cycle (§7.2)', () => {
    useLocaleStore.setState({ formatLocale: 'en-US', hourCycle: 'h23' });
    const { result, rerender } = renderHook(() => useAppClock());
    expect(result.current.wallTime('2026-10-03', '09:05')).toBe('09:05');
    useLocaleStore.setState({ hourCycle: 'h12' });
    rerender();
    expect(result.current.wallTime('2026-10-03', '15:30')).toMatch(/^3:30\s?pm$/i);
  });

  describe('moments on Monday 5 Oct 2026, 11:30 in the clinic', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-05T06:00:00.000Z'));
    });

    const render = () => {
      const { result } = renderHook(() => useAppClock());
      return {
        moment: (instant: string, withTime?: boolean) =>
          plain(result.current.moment(instant, { withTime })),
        day: (date: string) => result.current.day(date),
        wallMoment: (date: string, time: string) =>
          plain(result.current.wallMoment(date, time)),
      };
    };

    it('reads today, yesterday, the weekday, the date and the year — 12-hour', () => {
      useLocaleStore.setState({
        formatLocale: 'en-GB',
        hourCycle: 'h12',
        timeZone: 'auto',
      });
      const { moment, day } = render();
      expect(moment('2026-10-05T05:00:00.000Z')).toBe('Today 10:30 am');
      expect(moment('2026-10-04T03:40:00.000Z')).toBe('Yesterday 9:10 am');
      expect(moment('2026-10-02T10:30:00.000Z')).toBe('Fri 4:00 pm');
      expect(moment('2026-09-29T10:30:00.000Z')).toBe('Tue 4:00 pm');
      expect(moment('2026-09-28T10:30:00.000Z')).toBe('28 Sept 4:00 pm');
      expect(moment('2025-12-24T10:30:00.000Z')).toBe('24 Dec 2025 4:00 pm');
      expect(moment('2026-10-06T05:30:00.000Z')).toBe('Tomorrow 11:00 am');
      expect(moment('2026-10-09T10:30:00.000Z')).toBe('9 Oct 4:00 pm');
      expect(moment('2026-10-04T03:40:00.000Z', false)).toBe('Yesterday');
      expect(day('2026-10-05')).toBe('Today');
      expect(day('2026-10-01')).toBe('Thu');
    });

    it('isolates the time beside a day word; the day word keeps the page’s direction', () => {
      useLocaleStore.setState({
        formatLocale: 'en-GB',
        hourCycle: 'h12',
        timeZone: 'auto',
      });
      const { result } = renderHook(() => useAppClock());
      // "9:10 am" stays whole beside a right-to-left day word ("أمس 9:10 am").
      expect(result.current.moment('2026-10-04T03:40:00.000Z')).toBe(
        `Yesterday ${fsi('9:10\u00a0am')}`,
      );
      expect(result.current.day('2026-10-04')).toBe('Yesterday');
      // A date is a data token too; a weekday is a day word.
      expect(result.current.day('2026-09-28')).toBe(fsi('28 Sept'));
      expect(result.current.day('2026-10-01')).toBe('Thu');
    });

    it('follows the member’s 24-hour clock', () => {
      useLocaleStore.setState({
        formatLocale: 'en-US',
        hourCycle: 'h23',
        timeZone: 'auto',
      });
      const { moment, wallMoment } = render();
      expect(moment('2026-10-05T05:00:00.000Z')).toBe('Today 10:30');
      expect(moment('2026-10-04T03:40:00.000Z')).toBe('Yesterday 09:10');
      expect(moment('2026-10-02T10:30:00.000Z')).toBe('Fri 16:00');
      expect(wallMoment('2026-10-05', '15:30')).toBe('Today 15:30');
      expect(wallMoment('2026-10-07', '09:00')).toBe('Oct 7 09:00');
    });

    it('turns the day at midnight in the clinic’s zone, not at UTC midnight', () => {
      useLocaleStore.setState({
        formatLocale: 'en-GB',
        hourCycle: 'h12',
        timeZone: 'auto',
      });
      const { moment } = render();
      // 18:40 UTC on 4 Oct is 00:10 on 5 Oct in Asia/Kolkata — today.
      expect(moment('2026-10-04T18:40:00.000Z')).toBe('Today 12:10 am');
      // 18:20 UTC is 23:50 on the 4th — yesterday.
      expect(moment('2026-10-04T18:20:00.000Z')).toBe('Yesterday 11:50 pm');
    });

    it('moves the day with the time in a zone the viewer picked', () => {
      useLocaleStore.setState({
        formatLocale: 'en-GB',
        hourCycle: 'h12',
        timeZone: 'America/New_York',
      });
      const { moment } = render();
      // Now is 02:00 on Monday in New York; 18:40 UTC on the 4th is Sunday 2:40 pm there.
      expect(moment('2026-10-04T18:40:00.000Z')).toBe('Yesterday 2:40 pm');
    });

    it('speaks the member’s language and format locale (German)', async () => {
      await ensureNamespace('de', 'common');
      await ensureNamespace('de', 'app');
      await i18n.changeLanguage('de');
      useLocaleStore.setState({
        formatLocale: 'de-DE',
        hourCycle: 'h23',
        timeZone: 'auto',
      });
      const { moment, day } = render();
      expect(moment('2026-10-05T05:00:00.000Z')).toBe('Heute 10:30');
      expect(moment('2026-10-04T03:40:00.000Z')).toBe('Gestern 9:10');
      expect(moment('2026-10-02T10:30:00.000Z')).toBe('Fr 16:00');
      expect(moment('2026-09-28T10:30:00.000Z', false)).toBe('28. Sept.');
      expect(day('2026-10-05')).toBe('Heute');
    });
  });
});
