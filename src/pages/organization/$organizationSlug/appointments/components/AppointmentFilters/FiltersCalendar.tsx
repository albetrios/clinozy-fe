import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import {
  addCivilDays,
  clinicToday,
  localDateOf,
} from '@/shared/api/clinic/clinic-time.ts';
import { useAppointmentRange } from '@/shared/hooks/useAppointments/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { ChevronLeft, ChevronRight } from '@/shared/icons/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { shiftAnchor } from '../../hooks/useAppointmentsNavigation/index.ts';
import { loadDots, monthDays } from './appointment-filters-model.ts';

/** A calendar month's first day, `YYYY-MM-01`. */
const monthOf = (date: string) => `${date.slice(0, 7)}-01`;

/** The first day's column, Sunday first (H:5920) — literal classes for Tailwind. */
const FIRST_COLUMN = [
  'col-start-1',
  'col-start-2',
  'col-start-3',
  'col-start-4',
  'col-start-5',
  'col-start-6',
  'col-start-7',
] as const;

/** A day's dots, by name — at most three. */
const DOTS = ['first', 'second', 'third'] as const;

/** A dot's colour by the day's load: sage, butter, then the red of a full day. */
const DOT_COLOURS = ['', 'bg-tone-sage-dot', 'bg-tone-butter-dot', 'bg-now-indicator'];

/** Bookings that hold a slot on each day — every one but a cancelled one (`perDay`, H:5893). */
function bookedByDay(rows: readonly AppointmentRow[]): Map<string, number> {
  const booked = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== 'cancelled') booked.set(row.date, (booked.get(row.date) ?? 0) + 1);
  }
  return booked;
}

/** Props for {@link FiltersCalendar}. */
export interface FiltersCalendarProps {
  /** The day picked, pending until "Apply filter"; `undefined` is "Upcoming". */
  value: string | undefined;
  onChange: (date: string | undefined) => void;
  /** The header branch picker's branches (empty = all). */
  branchIds: readonly string[];
}

/**
 * The Filters' mini month calendar (H:2000–2007; `appointments.md:107`):
 * "‹ <Month YYYY> ›", S M T W T F S, 32px days with one to three load dots,
 * past days at 60%, today grey, the pick dark; each day's tooltip "<date> ·
 * <n> booked". A second press on the picked day clears it; "Upcoming
 * (default)" goes back to every day from today. It keeps its own month — the
 * prototype shared one with the Month board (H:5919, §7.3).
 */
export function FiltersCalendar({ value, onChange, branchIds }: FiltersCalendarProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const { formatDate } = useLocaleFormat();
  const today = clinicToday();
  const [month, setMonth] = useState(() => monthOf(value ?? today));
  const days = monthDays(month);
  const firstColumn = FIRST_COLUMN[localDateOf(month).getDay()];
  const range = useAppointmentRange(
    {
      from: month,
      to: addCivilDays(shiftAnchor(month, 'month', 1), -1),
      status: 'all',
      branchIds: [...branchIds],
    },
    { notifyOnError: false },
  );
  const booked = bookedByDay(range.data ?? []);
  const keys = APPOINTMENTS_KEYS.filters;
  // A week of Sunday-first days, for the weekday initials.
  const sunday = addCivilDays(today, -localDateOf(today).getDay());
  const weekdays = Array.from({ length: 7 }, (_, index) => addCivilDays(sunday, index));

  return (
    <div
      data-testid={APPOINTMENTS_TEST_IDS.filtersCalendar}
      className="flex flex-col gap-2 rounded-lg border p-2.5"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t(keys.previousMonth)}
          title={t(keys.previousMonth)}
          data-testid={APPOINTMENTS_TEST_IDS.filtersMonthPrevious}
          data-slot="button"
          onClick={() => setMonth(shiftAnchor(month, 'month', -1))}
          className="bg-card hover:bg-muted flex size-8 items-center justify-center rounded-lg border transition-colors"
        >
          <ChevronLeft aria-hidden="true" className="size-3.75 rtl:rotate-180" />
        </button>
        <span className="text-body font-semibold" aria-live="polite">
          {formatDate(
            localDateOf(month),
            { month: 'short', year: 'numeric' },
            { civilDay: true },
          )}
        </span>
        <button
          type="button"
          aria-label={t(keys.nextMonth)}
          title={t(keys.nextMonth)}
          data-testid={APPOINTMENTS_TEST_IDS.filtersMonthNext}
          data-slot="button"
          onClick={() => setMonth(shiftAnchor(month, 'month', 1))}
          className="bg-card hover:bg-muted flex size-8 items-center justify-center rounded-lg border transition-colors"
        >
          <ChevronRight aria-hidden="true" className="size-3.75 rtl:rotate-180" />
        </button>
      </div>
      <div
        aria-hidden="true"
        className="text-tiny text-muted-foreground grid grid-cols-7 gap-0.5 text-center"
      >
        {weekdays.map((day) => (
          <span key={day}>
            {formatDate(localDateOf(day), { weekday: 'narrow' }, { civilDay: true })}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, index) => {
          const count = booked.get(day) ?? 0;
          const picked = value === day;
          const isToday = day === today;
          const label = t(keys.dayBooked, { date: day, count });
          let fill = 'hover:bg-muted';
          if (picked) fill = 'bg-primary text-primary-foreground';
          else if (isToday) fill = 'bg-muted';
          return (
            <button
              key={day}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={picked}
              data-testid={APPOINTMENTS_TEST_IDS.filtersDay}
              data-day={day}
              onClick={() => onChange(picked ? undefined : day)}
              className={cn(
                'text-body flex h-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors',
                index === 0 && firstColumn,
                fill,
                (picked || isToday) && 'font-semibold',
                day < today && 'opacity-60',
              )}
            >
              {formatDate(localDateOf(day), { day: 'numeric' }, { civilDay: true })}
              <span aria-hidden="true" className="flex h-1 gap-0.5">
                {DOTS.slice(0, loadDots(count)).map((dot) => (
                  <span
                    key={dot}
                    className={cn(
                      'size-1 rounded-full',
                      picked ? 'bg-canvas' : DOT_COLOURS[loadDots(count)],
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-pressed={value === undefined}
        data-testid={APPOINTMENTS_TEST_IDS.filtersUpcoming}
        onClick={() => onChange(undefined)}
        className={cn(
          'text-body h-8 rounded-lg border transition-colors',
          value === undefined ? 'bg-muted' : 'bg-card hover:bg-muted',
        )}
      >
        {t(keys.upcoming)}
      </button>
    </div>
  );
}
