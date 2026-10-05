import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { weekdayHeaders } from '@/lib/i18n/weekday-headers.ts';
import { cn } from '@/lib/utils.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { addCivilDays, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { type LoadTone, RAIL_HEIGHT, weekLoad } from '../../appointments.calendar.ts';
import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';
import { useCalendarClock } from '../../hooks/useCalendarClock/index.ts';
import { useCalendarRange } from '../../hooks/useCalendarRange/index.ts';
import { CalendarCard, DayColumn, HourRail } from '../CalendarGrid/index.ts';

/** The load bar's fill in its band's ink (H:5933) — literal classes for Tailwind. */
const LOAD_FILL: Readonly<Record<LoadTone, string>> = {
  sage: 'bg-tone-sage-foreground',
  butter: 'bg-tone-butter-foreground',
  blush: 'bg-tone-blush-foreground',
};

/** The rail and seven day columns, at least 150px each: 1,102px, scrolling sideways below it. */
const WEEK_COLUMNS = 'grid-cols-[52px_repeat(7,minmax(150px,1fr))]';

/**
 * A Week day's header (H:2069; `appointments.md:53`): the weekday 11px, the
 * date 18/600 (red today), and the day's load — a 3px bar in its band's ink
 * with "<n> booked · <p>% of chair time" (" · overlapping booking") — and a
 * 6px red dot when a doctor is double-booked; a past day at 45%. A press
 * opens the day in Day.
 */
function WeekDayHeader({
  date,
  today,
  rows,
  loading,
  onOpen,
}: {
  date: string;
  today: string;
  rows: readonly AppointmentRow[];
  loading: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const { formatDate, prefs } = useLocaleFormat();
  const day = localDateOf(date);
  const load = weekLoad(rows);
  const keys = APPOINTMENTS_KEYS.calendar;
  const loadTitle = t(load.overlap ? keys.chairTimeOverlap : keys.chairTime, {
    count: load.booked,
    percent: load.percent,
  });
  return (
    <button
      type="button"
      data-testid={APPOINTMENTS_TEST_IDS.weekDay}
      data-date={date}
      onClick={onOpen}
      className={cn(
        'flex min-w-0 items-baseline gap-1.5 px-2 py-2.5 text-start',
        date < today && 'opacity-45',
      )}
    >
      <span className="text-micro text-muted-foreground leading-[1.25]">
        {weekdayHeaders(prefs.formatLocale, 'short')[day.getDay()]}
      </span>
      <span
        className={cn(
          'text-lg leading-[1.25] font-semibold tabular-nums',
          date === today && 'text-destructive',
        )}
      >
        {formatDate(day, { day: 'numeric' }, { civilDay: true })}
      </span>
      <span
        title={loadTitle}
        className={cn(
          'relative mt-1 flex w-full items-center gap-1',
          loading && 'opacity-0',
        )}
      >
        <span className="bg-muted-strong h-0.75 flex-1 overflow-hidden rounded-xs">
          <span
            style={{ '--load': `${load.percent}%` } as CSSProperties}
            className={cn('block h-full w-(--load)', LOAD_FILL[load.tone])}
          />
        </span>
        {load.overlap ? (
          <span
            role="img"
            aria-label={t(keys.overlap)}
            className="bg-now-indicator size-1.5 flex-none rounded-full"
          />
        ) : null}
      </span>
    </button>
  );
}

/**
 * The Week view (KICKOFF §6.4 Week; H:2067–2079, H:5926–5934): the 52px hour
 * rail and seven day columns, Sunday first (Q-A10), under a sticky row of day
 * headers that open each day in Day. Columns are not booked from (only the
 * Day is). Not offered on a phone — `view=week` renders Day there; a tablet
 * scrolls the 1,102px board sideways.
 */
export function AppointmentsWeek() {
  const navigation = useAppointmentsNavigation();
  const clock = useCalendarClock();
  const read = useCalendarRange('week');
  const days = Array.from({ length: 7 }, (_, index) =>
    addCivilDays(read.range.from, index),
  );
  const rowsOf = (date: string) => read.rows.filter((row) => row.date === date);
  const loading = read.pending || read.refreshing;

  return (
    <CalendarCard view="week">
      <div
        style={{ '--rail-height': `${RAIL_HEIGHT}px` } as CSSProperties}
        className="min-h-0 flex-1 overflow-auto px-3 pb-3"
      >
        <div className="min-w-fit">
          <div
            className={cn(
              'bg-card border-border sticky top-0 z-3 grid border-b',
              WEEK_COLUMNS,
            )}
          >
            <span aria-hidden="true" />
            {days.map((date) => (
              <WeekDayHeader
                key={date}
                date={date}
                today={clock.today}
                rows={rowsOf(date)}
                loading={loading}
                onOpen={() => navigation.openDay(date)}
              />
            ))}
          </div>
          <div className={cn('relative grid h-(--rail-height)', WEEK_COLUMNS)}>
            <HourRail />
            {days.map((date) => (
              <DayColumn
                key={date}
                date={date}
                rows={rowsOf(date)}
                clock={clock}
                refreshing={read.refreshing}
              />
            ))}
          </div>
        </div>
      </div>
    </CalendarCard>
  );
}
