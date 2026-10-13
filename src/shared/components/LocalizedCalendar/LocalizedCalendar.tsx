import { type ComponentProps, useMemo } from 'react';
import type { ClassNames } from 'react-day-picker';

import { weekdayHeaders } from '@/lib/i18n/weekday-headers.ts';
import { cn } from '@/lib/utils.ts';
import { civilDateOf } from '@/shared/api/app/app-time.ts';
import { Calendar } from '@/shared/components/ui/calendar.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  CalendarChevron,
  CalendarDayButton,
  CalendarNextButton,
  CalendarPreviousButton,
  CalendarRoot,
} from './calendar-parts.tsx';
import {
  type CalendarDayDots,
  type CalendarLook,
  type CalendarParts,
  CalendarPartsContext,
  type CalendarTestIds,
  type CalendarTone,
} from './calendar-parts-context.ts';

type CalendarProps = ComponentProps<typeof Calendar>;

/** Props of {@link LocalizedCalendar}: react-day-picker's, and the month grid's own. */
export type LocalizedCalendarProps = CalendarProps & {
  /** The grid's look (default `picker`, the date field's popover). */
  look?: CalendarLook;
  /** What today and the pick wear (default `primary`). */
  tone?: CalendarTone;
  /**
   * Each day's dots by its `YYYY-MM-DD` — a `dots` modifier: the days it
   * answers for carry one to three dots under their number.
   */
  dots?: (isoDate: string) => CalendarDayDots | undefined;
  /** Test ids of the days and the arrows. */
  testIds?: CalendarTestIds;
};

function weekStartsOnFromPrefs(
  firstDayOfWeek: 'saturday' | 'sunday' | 'monday',
): 0 | 1 | 6 {
  if (firstDayOfWeek === 'sunday') return 0;
  if (firstDayOfWeek === 'saturday') return 6;
  return 1;
}

/** A room look's arrow: a bordered square on the card, faded while there is no month that way. */
const ROOM_ARROW = {
  compact:
    'bg-card text-foreground-soft hover:bg-muted flex size-6 items-center justify-center rounded-md border transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-50',
  regular:
    'bg-card hover:bg-muted flex size-8 items-center justify-center rounded-lg border transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-50',
} as const;

/**
 * The room looks' parts (H:2779–2781, H:2000–2007): the arrows around the
 * caption on one row, the two-letter weekdays, then seven equal columns of
 * days 1px (compact) or 2px (regular) apart. Replaces the vendored classes
 * for these keys; the day buttons carry their own (`calendar-parts.tsx`).
 */
const ROOM_CLASS_NAMES: Readonly<
  Record<Exclude<CalendarLook, 'picker'>, Partial<ClassNames>>
> = {
  compact: {
    root: 'w-full',
    months: 'flex flex-col',
    month: 'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-y-1',
    month_caption: 'flex min-w-0 items-center justify-center',
    caption_label: 'text-detail truncate font-semibold',
    button_previous: ROOM_ARROW.compact,
    button_next: ROOM_ARROW.compact,
    chevron: 'size-3.5',
    month_grid: 'col-span-3 w-full border-collapse',
    weekdays: 'flex gap-px',
    weekday:
      'text-muted-foreground flex h-5 min-w-0 flex-1 items-center justify-center text-[length:calc(var(--text-xs)*5/6)] font-normal',
    week: 'mt-px flex w-full gap-px',
    day: 'min-w-0 flex-1 p-0 text-center',
    outside: '',
    hidden: 'invisible',
  },
  regular: {
    root: 'w-full',
    months: 'flex flex-col',
    month: 'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-y-2',
    month_caption: 'flex min-w-0 items-center justify-center',
    caption_label: 'text-body truncate font-semibold',
    button_previous: ROOM_ARROW.regular,
    button_next: ROOM_ARROW.regular,
    chevron: 'size-3.75',
    month_grid: 'col-span-3 w-full border-collapse',
    weekdays: 'flex gap-0.5',
    weekday: 'text-tiny text-muted-foreground min-w-0 flex-1 text-center font-normal',
    week: 'mt-0.5 flex w-full gap-0.5',
    day: 'min-w-0 flex-1 p-0 text-center',
    outside: '',
    hidden: 'invisible',
  },
};

/**
 * Every look leaves today and the off days to the day button (`data-day-state`):
 * the vendored cell fills would show their square corners behind a round pick.
 */
const DAY_CELL_CLASS_NAMES: Partial<ClassNames> = { today: '', disabled: '' };

/** The caption's month, per look: the booking step's in full, the Filters' short. */
const CAPTION_MONTH = { compact: 'long', regular: 'short', picker: 'long' } as const;

/**
 * The app's one month grid — react-day-picker under the vendored `ui/calendar`,
 * localised from {@link useLocaleFormat}: the week starts on the locale's
 * first day unless the caller says (the clinic's Sunday, Q-A10), the weekday
 * headers read the format locale's two letters ("Mo Tu We",
 * {@link weekdayHeaders}) each named in full for a screen reader, and the
 * caption, the month dropdown and every day's name are formatted dates. One
 * tab stop: arrow keys move between days (mirrored right-to-left), Enter or
 * Space picks. Three looks share it — the date field's popover
 * (`CalendarPicker`), the booking step's and the Filters' month — with a
 * `dots` modifier for days with marks (the Filters' load dots) and test ids on
 * every day (`data-day="YYYY-MM-DD"`) and arrow. App code imports this instead
 * of the vendored calendar so Appearance prefs apply by default.
 */
export function LocalizedCalendar({
  look = 'picker',
  tone = 'primary',
  dots,
  testIds,
  weekStartsOn,
  formatters,
  labels,
  modifiers,
  classNames,
  components,
  className,
  ...props
}: LocalizedCalendarProps) {
  const { formatDate, firstDayOfWeek, direction, prefs } = useLocaleFormat();
  const headers = weekdayHeaders(prefs.formatLocale);
  const parts = useMemo<CalendarParts>(
    () => ({ look, tone, dots, testIds }),
    [look, tone, dots, testIds],
  );
  const roomLook = look === 'picker' ? undefined : look;
  const monthName = CAPTION_MONTH[look];

  return (
    <CalendarPartsContext.Provider value={parts}>
      <Calendar
        weekStartsOn={weekStartsOn ?? weekStartsOnFromPrefs(firstDayOfWeek)}
        dir={direction}
        navLayout={roomLook ? 'around' : undefined}
        // react-day-picker hands us local-midnight Dates: civilDay keeps a
        // display timezone west of the device from labelling March as Feb.
        formatters={{
          formatCaption: (date) =>
            formatDate(date, { month: monthName, year: 'numeric' }, { civilDay: true }),
          formatMonthDropdown: (date) =>
            formatDate(date, { month: 'short' }, { civilDay: true }),
          formatYearDropdown: (date) =>
            formatDate(date, { year: 'numeric' }, { civilDay: true }),
          formatDay: (date) => formatDate(date, { day: 'numeric' }, { civilDay: true }),
          formatWeekdayName: (date) => headers[date.getDay()] ?? '',
          ...formatters,
        }}
        labels={{
          labelWeekday: (date) =>
            formatDate(date, { weekday: 'long' }, { civilDay: true }),
          labelGrid: (date) =>
            formatDate(date, { month: 'long', year: 'numeric' }, { civilDay: true }),
          labelDayButton: (date) =>
            formatDate(
              date,
              { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
              { civilDay: true },
            ),
          ...labels,
        }}
        modifiers={{
          ...(dots
            ? { dots: (date: Date) => dots(civilDateOf(date)) !== undefined }
            : {}),
          ...modifiers,
        }}
        classNames={{
          ...DAY_CELL_CLASS_NAMES,
          ...(roomLook ? ROOM_CLASS_NAMES[roomLook] : {}),
          ...classNames,
        }}
        components={{
          Root: CalendarRoot,
          DayButton: CalendarDayButton,
          PreviousMonthButton: CalendarPreviousButton,
          NextMonthButton: CalendarNextButton,
          Chevron: CalendarChevron,
          ...components,
        }}
        className={cn(roomLook && 'bg-transparent p-0', className)}
        {...props}
      />
    </CalendarPartsContext.Provider>
  );
}
