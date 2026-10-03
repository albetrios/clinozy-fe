import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import { Picker } from '@/shared/components/Picker/Picker.tsx';
import type {
  PickerFilter,
  PickerSize,
} from '@/shared/components/Picker/picker.types.ts';
import { filterPickerOptions } from '@/shared/components/Picker/picker-rows.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  buildDateOptions,
  dateOption,
  type DateOptionFormat,
  ENGLISH_MONTH_NAMES,
  parseTypedDate,
  type TypedDateLocale,
  withinRange,
} from './date-options.ts';

/** Props for {@link DatePicker}. */
export interface DatePickerProps {
  /** The picked civil date, `YYYY-MM-DD`. */
  value: string | null;
  onChange: (date: string | null) => void;
  /** The field's name (default "Date"). */
  label?: string;
  /** Trigger text with no date (default "Pick a date"). */
  placeholder?: string;
  /** Days back the list reaches (default 120). */
  past?: number;
  /** Days ahead the list reaches (default 60). */
  future?: number;
  /** Earliest date offered or accepted, `YYYY-MM-DD`. */
  min?: string;
  /** Latest date offered or accepted, `YYYY-MM-DD`. */
  max?: string;
  /** Today's civil date (default: the clinic's, Asia/Kolkata). */
  today?: string;
  clearable?: boolean;
  /** Trigger size (default `sm`, as the design's date dropdown). */
  size?: PickerSize;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-describedby'?: string;
  /** `<room>:<field>` for a Recent group of picked dates. */
  recentKey?: string;
  align?: 'start' | 'end';
  /** Base test id (default `date-picker`); options are `<id>-option-<YYYY-MM-DD>`. */
  testId?: string;
  className?: string;
}

/** A November date whose day (22) and month (11) differ, to read the locale's order. */
const ORDER_PROBE = new Date(2026, 10, 22);

/**
 * The date dropdown (H:4453–4459): a {@link Picker} of "Today · Sat 3 Oct",
 * "Tomorrow · Sun 4 Oct", … grouped Today / Coming up / <Mon YYYY>, 250px
 * wide, at most 320px tall. Its search ("Type a date · e.g. 12 sep") filters
 * the list and also reads a typed date — "12 sep", "sep 12", "12/9",
 * "2026-09-12" — offering it first even outside the window. Values are civil
 * dates (`YYYY-MM-DD`); labels come from {@link useLocaleFormat}.
 */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder,
  past,
  future,
  min,
  max,
  today: todayProp,
  size = 'sm',
  testId = 'date-picker',
  ...rest
}: DatePickerProps) {
  const { t } = useTranslation(PICKER_NS);
  const { formatDate } = useLocaleFormat();
  const [clinicDay] = useState(() => clinicToday());
  const today = todayProp ?? clinicDay;

  const format = useMemo<DateOptionFormat>(
    () => ({
      today: t(PICKER_KEYS.date.today),
      tomorrow: t(PICKER_KEYS.date.tomorrow),
      yesterday: t(PICKER_KEYS.date.yesterday),
      comingUp: t(PICKER_KEYS.date.comingUp),
      relative: (relative, day) => t(PICKER_KEYS.date.relative, { relative, date: day }),
      day: (date, withYear) =>
        formatDate(
          localDateOf(date),
          {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            ...(withYear ? { year: 'numeric' } : {}),
          },
          { civilDay: true },
        ),
      month: (date) =>
        formatDate(
          localDateOf(date),
          { month: 'short', year: 'numeric' },
          { civilDay: true },
        ),
    }),
    [t, formatDate],
  );

  const typedLocale = useMemo<TypedDateLocale>(() => {
    const names = (month: number) =>
      (['short', 'long'] as const).map((width) =>
        formatDate(new Date(2026, month, 15), { month: width }, { civilDay: true })
          .toLowerCase()
          .replace(/\.$/, ''),
      );
    const probe = formatDate(
      ORDER_PROBE,
      { day: 'numeric', month: 'numeric' },
      { civilDay: true },
    );
    const dayAt = probe.indexOf('22');
    const monthAt = probe.indexOf('11');
    return {
      months: ENGLISH_MONTH_NAMES.map((english, month) => [...names(month), ...english]),
      dayFirst: dayAt < 0 || monthAt < 0 || dayAt < monthAt,
    };
  }, [formatDate]);

  const options = useMemo(
    () => buildDateOptions({ today, past, future, min, max }, format),
    [today, past, future, min, max, format],
  );

  const filter = useCallback<PickerFilter<string>>(
    (list, query) => {
      const matched = filterPickerOptions(list, query);
      const typed = parseTypedDate(query, today, typedLocale);
      const offered = typed !== null && withinRange(typed, { min, max });
      if (!offered) return matched;
      const typedOption =
        list.find((option) => option.key === typed) ?? dateOption(typed, today, format);
      return [typedOption, ...matched.filter((option) => option.key !== typed)];
    },
    [today, typedLocale, min, max, format],
  );

  const selectedOptions = useMemo(
    () => (value ? [dateOption(value, today, format)] : undefined),
    [value, today, format],
  );

  return (
    <Picker<string>
      {...rest}
      value={value}
      onChange={(key) => onChange(key)}
      options={options}
      selectedOptions={selectedOptions}
      filter={filter}
      label={label ?? t(PICKER_KEYS.date.label)}
      placeholder={placeholder ?? t(PICKER_KEYS.date.placeholder)}
      searchPlaceholder={t(PICKER_KEYS.date.search)}
      searchable
      size={size}
      minWidth={250}
      maxHeight={320}
      testId={testId}
    />
  );
}
