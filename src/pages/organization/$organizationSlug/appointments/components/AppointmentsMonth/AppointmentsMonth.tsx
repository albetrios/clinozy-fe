import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  appointmentViewRange,
  monthCells,
} from '@/shared/api/clinic/appointment-views.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { addCivilDays, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { SKELETON_IN_PLACE } from '@/shared/components/SkeletonRows/index.ts';
import { useElementWidth } from '@/shared/hooks/useElementWidth/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { doubleBooked, monthFit } from '../../appointments.calendar.ts';
import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';
import { useCalendarClock } from '../../hooks/useCalendarClock/index.ts';
import { useCalendarRange } from '../../hooks/useCalendarRange/index.ts';
import { CalendarBlock } from '../CalendarBlock/index.ts';
import { CalendarCard } from '../CalendarGrid/index.ts';
import { MonthDayPopover } from './MonthDayPopover.tsx';

/** Props for {@link MonthCell}. */
interface MonthCellProps {
  date: string;
  today: string;
  /** The day's bookings in slot order. */
  rows: readonly AppointmentRow[];
  /** How many chips the cells hold (`monthFit`). */
  fit: number;
  refreshing: boolean;
  onOpenDay: (date: string) => void;
}

/**
 * One Month cell (H:2085, H:5937–5940; `appointments.md:53`): the date 12px
 * (today 700 in red with a dark border), a red dot "Overlapping booking", the
 * day's bookings as single-line 26px chips — as many as fit — then "+<n>
 * more" for the day popover; a past day at 62%. The cell opens its day in Day
 * (its own button, behind the chips).
 */
function MonthCell({ date, today, rows, fit, refreshing, onOpenDay }: MonthCellProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const { formatDate } = useLocaleFormat();
  const cellRef = useRef<HTMLDivElement>(null);
  const day = localDateOf(date);
  const shown = rows.slice(0, fit);
  const more = rows.length - shown.length;
  const isToday = date === today;
  return (
    <div
      ref={cellRef}
      data-testid={APPOINTMENTS_TEST_IDS.monthCell}
      data-date={date}
      className={cn(
        'relative flex min-w-0 flex-1 flex-col gap-1 overflow-hidden rounded-lg border p-1.5 transition-colors',
        isToday
          ? 'border-primary bg-canvas'
          : 'border-border bg-card hover:border-muted-foreground',
        date < today && 'opacity-62',
      )}
    >
      <button
        type="button"
        aria-label={formatDate(
          day,
          { weekday: 'long', day: 'numeric', month: 'long' },
          { civilDay: true },
        )}
        onClick={() => onOpenDay(date)}
        className="absolute inset-0 rounded-lg"
      />
      <span className="pointer-events-none relative flex w-full items-center gap-1">
        <span
          className={cn(
            'text-xs leading-[1.5] tabular-nums',
            isToday ? 'text-destructive font-bold' : 'font-medium',
          )}
        >
          {formatDate(day, { day: 'numeric' }, { civilDay: true })}
        </span>
        <span className="flex-1" />
        {doubleBooked(rows) ? (
          <span
            role="img"
            aria-label={t(APPOINTMENTS_KEYS.calendar.overlap)}
            title={t(APPOINTMENTS_KEYS.calendar.overlap)}
            className="bg-now-indicator pointer-events-auto size-1.5 flex-none rounded-full"
          />
        ) : null}
      </span>
      <div className={cn('contents', refreshing && SKELETON_IN_PLACE)}>
        {shown.map((row) => (
          <CalendarBlock key={row.id} appointment={row} variant="chip" />
        ))}
        {more > 0 ? (
          <MonthDayPopover
            date={date}
            rows={rows}
            cellRef={cellRef}
            onOpenDay={onOpenDay}
          >
            <button
              type="button"
              data-slot="pill"
              data-testid={APPOINTMENTS_TEST_IDS.monthMore}
              aria-haspopup="dialog"
              className="border-border bg-card text-foreground-soft hover:bg-muted text-micro relative h-5 flex-none self-start rounded-full border px-2 font-medium whitespace-nowrap transition-colors"
            >
              {t(APPOINTMENTS_KEYS.calendar.more, { count: more })}
            </button>
          </MonthDayPopover>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The Month view (KICKOFF §6.4 Month; H:2080–2087, H:5935–5940): Sun–Sat over
 * seven equal columns, gap 4px, the rows filling the card's height — the same
 * grid on a phone. Each cell fits as many single-line chips as its height
 * holds (`monthFit`, measured), the rest behind "+<n> more"; a cell opens its
 * day in Day.
 */
export function AppointmentsMonth() {
  const { formatDate } = useLocaleFormat();
  const navigation = useAppointmentsNavigation();
  const clock = useCalendarClock();
  const read = useCalendarRange('month');
  const cells = monthCells(navigation.anchor);
  const [measureCell, cellHeight] = useElementWidth<HTMLDivElement>(2, 'height');
  const sunday = appointmentViewRange('week', navigation.anchor).from;
  const weekdays = Array.from({ length: 7 }, (_, index) => addCivilDays(sunday, index));
  const rowsOf = (date: string) => read.rows.filter((row) => row.date === date);

  return (
    <CalendarCard view="month">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
        <div
          aria-hidden="true"
          className="text-micro text-muted-foreground grid grid-cols-7 gap-1 px-1"
        >
          {weekdays.map((date) => (
            <span key={date}>
              {formatDate(localDateOf(date), { weekday: 'short' }, { civilDay: true })}
            </span>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-7 gap-1">
          {cells.map((date, index) => {
            const measure = index === 0 ? measureCell : undefined;
            if (!date) {
              return (
                <div key={`blank-${String(index)}`} ref={measure} aria-hidden="true" />
              );
            }
            const rows = rowsOf(date);
            return (
              <div key={date} ref={measure} className="flex min-h-0 min-w-0">
                <MonthCell
                  date={date}
                  today={clock.today}
                  rows={rows}
                  fit={monthFit(cellHeight, rows.length)}
                  refreshing={read.refreshing}
                  onOpenDay={navigation.openDay}
                />
              </div>
            );
          })}
        </div>
      </div>
    </CalendarCard>
  );
}
