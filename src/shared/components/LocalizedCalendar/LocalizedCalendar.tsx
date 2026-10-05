import type { ComponentProps } from 'react';

import { weekdayHeaders } from '@/lib/i18n/weekday-headers.ts';
import { Calendar } from '@/shared/components/ui/calendar.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

type CalendarProps = ComponentProps<typeof Calendar>;

function weekStartsOnFromPrefs(
  firstDayOfWeek: 'saturday' | 'sunday' | 'monday',
): 0 | 1 | 6 {
  if (firstDayOfWeek === 'sunday') return 0;
  if (firstDayOfWeek === 'saturday') return 6;
  return 1;
}

/**
 * Locale-aware Calendar — injects `weekStartsOn`, the month dropdown and the
 * weekday headers from {@link useLocaleFormat}: the headers read the format
 * locale's two-letter days ("Mo Tu We", {@link weekdayHeaders}), each named in
 * full for a screen reader. App code should import this instead of the
 * vendored `ui/calendar` so new date-picker surfaces honour Appearance prefs by
 * default.
 */
export function LocalizedCalendar({
  weekStartsOn,
  formatters,
  labels,
  ...props
}: CalendarProps) {
  const { formatDate, firstDayOfWeek, prefs } = useLocaleFormat();
  const headers = weekdayHeaders(prefs.formatLocale);
  return (
    <Calendar
      weekStartsOn={weekStartsOn ?? weekStartsOnFromPrefs(firstDayOfWeek)}
      formatters={{
        // react-day-picker hands us local-midnight Dates: civilDay keeps a
        // display timezone west of the device from labelling March as Feb.
        formatMonthDropdown: (date) =>
          formatDate(date, { month: 'short' }, { civilDay: true }),
        formatWeekdayName: (date) => headers[date.getDay()] ?? '',
        ...formatters,
      }}
      labels={{
        labelWeekday: (date) => formatDate(date, { weekday: 'long' }, { civilDay: true }),
        ...labels,
      }}
      {...props}
    />
  );
}
