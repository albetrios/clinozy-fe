import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentDayCount } from '@/shared/api/clinic/appointments-contracts.ts';
import {
  addCivilDays,
  civilDateOf,
  civilMonthStart,
  clinicToday,
  localDateOf,
} from '@/shared/api/clinic/clinic-time.ts';
import {
  type CalendarDayDots,
  LocalizedCalendar,
} from '@/shared/components/LocalizedCalendar/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useAppointmentDayCounts } from '@/shared/hooks/useAppointments/index.ts';

import { loadDots } from '../../appointments.calendar.ts';
import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { shiftAnchor } from '../../hooks/useAppointmentsNavigation/index.ts';

/** A dot's colour by the day's load: sage, butter, then the red of a full day. */
const DOT_COLOURS = {
  1: 'bg-tone-sage-dot',
  2: 'bg-tone-butter-dot',
  3: 'bg-now-indicator',
} as const;

/**
 * Bookings that hold a slot on each day — every one but a cancelled one
 * (`perDay`, H:5893), from the server's day counts.
 */
function bookedByDay(days: readonly AppointmentDayCount[]): Map<string, number> {
  return new Map(days.map((day) => [day.date, day.total - day.byStatus.cancelled]));
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
 * The Filters' mini month calendar (H:2000–2007; `appointments.md:107`) — the
 * app's month grid in its `regular` look: "‹ <Mon YYYY> ›", the two-letter
 * weekdays Sunday first (Q-A10), 32px days with one to three load dots, past
 * days at 60%, today grey, the pick dark; each day's tooltip "<date> · <n>
 * booked" — the month's `daily-counts` within the header's branches, every
 * doctor and status. A second press on the picked day clears it; "Upcoming
 * (default)" goes back to every day from today. It keeps its own month — the
 * prototype shared one with the Month board (H:5919, §7.3).
 */
export function FiltersCalendar({ value, onChange, branchIds }: FiltersCalendarProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const today = clinicToday();
  const [month, setMonth] = useState(() => civilMonthStart(value ?? today));
  const counts = useAppointmentDayCounts(
    {
      from: month,
      to: addCivilDays(shiftAnchor(month, 'month', 1), -1),
      branchIds,
    },
    { notifyOnError: false },
  );
  const booked = bookedByDay(counts.data ?? []);
  const keys = APPOINTMENTS_KEYS.filters;
  const dots = (date: string): CalendarDayDots | undefined => {
    const level = loadDots(booked.get(date) ?? 0);
    return level === 0 ? undefined : { count: level, className: DOT_COLOURS[level] };
  };

  return (
    <div
      data-testid={APPOINTMENTS_TEST_IDS.filtersCalendar}
      className="flex flex-col gap-2 rounded-lg border p-2.5"
    >
      <LocalizedCalendar
        look="regular"
        mode="single"
        selected={value ? localDateOf(value) : undefined}
        onSelect={(date) => onChange(date ? civilDateOf(date) : undefined)}
        month={localDateOf(month)}
        onMonthChange={(date) => setMonth(civilMonthStart(civilDateOf(date)))}
        today={localDateOf(today)}
        weekStartsOn={0}
        showOutsideDays={false}
        modifiers={{ past: { before: localDateOf(today) } }}
        modifiersClassNames={{ past: 'opacity-60' }}
        dots={dots}
        labels={{
          labelDayButton: (date) => {
            const day = civilDateOf(date);
            return t(keys.dayBooked, { date: day, count: booked.get(day) ?? 0 });
          },
          labelPrevious: () => t(keys.previousMonth),
          labelNext: () => t(keys.nextMonth),
        }}
        testIds={{
          day: APPOINTMENTS_TEST_IDS.filtersDay,
          previous: APPOINTMENTS_TEST_IDS.filtersMonthPrevious,
          next: APPOINTMENTS_TEST_IDS.filtersMonthNext,
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={value === undefined}
        data-testid={APPOINTMENTS_TEST_IDS.filtersUpcoming}
        onClick={() => onChange(undefined)}
        className={cn(
          'font-normal shadow-none',
          value === undefined ? 'bg-muted' : 'bg-card hover:bg-muted',
        )}
      >
        {t(keys.upcoming)}
      </Button>
    </div>
  );
}
