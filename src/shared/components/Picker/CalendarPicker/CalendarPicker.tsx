import { useMemo, useState } from 'react';
import type { Matcher } from 'react-day-picker';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { appToday, civilDateOf, localDateOf } from '@/shared/api/app/app-time.ts';
import { LocalizedCalendar } from '@/shared/components/LocalizedCalendar/index.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import type { PickerSize } from '@/shared/components/Picker/picker.types.ts';
import { PickerSheet } from '@/shared/components/Picker/PickerSheet/index.ts';
import { PickerTrigger } from '@/shared/components/Picker/PickerTrigger/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Calendar } from '@/shared/icons/index.ts';

/** Years back and ahead the month / year dropdowns reach without `min` / `max`. */
const YEARS_BACK = 100;
const YEARS_AHEAD = 10;

/**
 * On open, focus the calendar's roving day — the picked day, else today —
 * which react-day-picker marks as the one tabbable day.
 */
function focusDay(event: Event) {
  const panel = event.target instanceof HTMLElement ? event.target : null;
  panel?.querySelector<HTMLElement>('button[data-day][tabindex="0"]')?.focus();
}

/** Props for {@link CalendarPicker}. */
export interface CalendarPickerProps {
  /** The picked civil date, `YYYY-MM-DD`. */
  value: string | null;
  onChange: (date: string) => void;
  /** The field's name (default "Date"). */
  label?: string;
  /** Trigger text with no date (default "Pick a date"). */
  placeholder?: string;
  /** Earliest date allowed, `YYYY-MM-DD` (earlier days are disabled). */
  min?: string;
  /** Latest date allowed, `YYYY-MM-DD`. */
  max?: string;
  /** Today's civil date (default: the clinic's). */
  today?: string;
  size?: PickerSize;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-describedby'?: string;
  align?: 'start' | 'end';
  /** Base test id (default `calendar-picker`). */
  testId?: string;
  className?: string;
}

/**
 * The calendar date field (H:900): a 36px trigger with a calendar glyph and
 * the date ("3 Oct 2026") or "Pick a date", opening the 260px
 * {@link LocalizedCalendar} popover — padding 10px, `rounded-xl` — and the
 * picker sheet on a phone. The week starts on the locale's first day (Q-A10)
 * and month / year dropdowns reach far back (birth dates). Values are civil
 * dates; picking a day closes it.
 */
export function CalendarPicker({
  value,
  onChange,
  label,
  placeholder,
  min,
  max,
  today: todayProp,
  size = 'md',
  disabled,
  invalid,
  id,
  'aria-describedby': describedBy,
  align,
  testId = 'calendar-picker',
  className,
}: CalendarPickerProps) {
  const { t } = useTranslation(PICKER_NS);
  const { formatDate } = useLocaleFormat();
  const [open, setOpen] = useState(false);
  const [appDay] = useState(() => appToday());
  const today = localDateOf(todayProp ?? appDay);
  const selected = value ? localDateOf(value) : undefined;
  const name = label ?? t(PICKER_KEYS.date.label);
  const shown = selected
    ? formatDate(
        selected,
        { day: 'numeric', month: 'short', year: 'numeric' },
        { civilDay: true },
      )
    : undefined;
  const shownPlaceholder = placeholder ?? t(PICKER_KEYS.date.placeholder);
  // The name holds the words the trigger shows: the date, or the placeholder (WCAG 2.5.3).
  const triggerLabel = t(PICKER_KEYS.triggerLabel, {
    label: name,
    value: shown ?? shownPlaceholder,
  });

  const disabledDays = useMemo(() => {
    const matchers: Matcher[] = [];
    if (min) matchers.push({ before: localDateOf(min) });
    if (max) matchers.push({ after: localDateOf(max) });
    return matchers;
  }, [min, max]);
  const year = today.getFullYear();
  const startMonth = min ? localDateOf(min) : new Date(year - YEARS_BACK, 0, 1);
  const endMonth = max ? localDateOf(max) : new Date(year + YEARS_AHEAD, 11, 31);

  return (
    <div className={cn('relative min-w-0', className)}>
      <PickerSheet
        open={open}
        onOpenChange={(next) => setOpen(next && !disabled)}
        title={name}
        align={align}
        panelClassName="w-65 rounded-xl p-2.5"
        sheetClassName="items-center p-2.5"
        onOpenAutoFocus={focusDay}
        testId={`${testId}-panel`}
        trigger={
          <PickerTrigger
            id={id}
            size={size}
            disabled={disabled}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            aria-label={triggerLabel}
            title={triggerLabel}
            data-testid={testId}
            icon={<Calendar className="size-3.5" />}
          >
            {shown ? (
              <span className="truncate tabular-nums">{shown}</span>
            ) : (
              <span className="text-muted-foreground truncate">{shownPlaceholder}</span>
            )}
          </PickerTrigger>
        }
      >
        <LocalizedCalendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) onChange(civilDateOf(day));
            setOpen(false);
          }}
          defaultMonth={selected ?? today}
          today={today}
          disabled={disabledDays}
          startMonth={startMonth}
          endMonth={endMonth}
          captionLayout="dropdown"
          showOutsideDays={false}
          className="p-0 [--cell-size:--spacing(8.5)]"
        />
      </PickerSheet>
    </div>
  );
}
