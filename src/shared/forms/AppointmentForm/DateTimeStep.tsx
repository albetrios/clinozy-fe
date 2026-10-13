import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  addCivilDays,
  civilDateOf,
  civilMonthStart,
  localDateOf,
} from '@/shared/api/app/app-time.ts';
import {
  APPOINTMENT_SLOT_STEPS,
  type AppointmentClosedReason,
  type AppointmentSlotDay,
  type AppointmentSlotStep,
} from '@/shared/api/app/appointments-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  DrawerQuickChips,
  type DrawerQuickOption,
} from '@/shared/components/DrawerField/index.ts';
import { LocalizedCalendar } from '@/shared/components/LocalizedCalendar/index.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/index.ts';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';
import {
  type AppointmentDraft,
  type AppointmentFormChange,
  hourLabel,
  type SavedSlot,
  slotColumns,
  type SlotHour,
  slotHours,
} from './appointment-form-model.ts';

const K = APPOINTMENT_FORM_KEYS.slot;
const IDS = APPOINTMENT_FORM_TEST_IDS;

/** Literal classes for the slot rows' columns: ":00 :30" or ":00 :15 :30 :45". */
const SLOT_COLUMNS: Readonly<Record<AppointmentSlotStep, string>> = {
  30: 'grid-cols-2',
  15: 'grid-cols-4',
};

/** Props for {@link DateTimeStep}. */
export interface DateTimeStepProps {
  draft: AppointmentDraft;
  onChange: (change: AppointmentFormChange) => void;
  /** The saved slot (Edit) — a move back to it restores the status. */
  saved: SavedSlot | null;
  /**
   * The doctor's free starts that day, or why the day is closed (`GET /app/appointments/slots`)
   * — undefined until a date and a doctor are set.
   */
  slots: AppointmentSlotDay | undefined;
  slotStep: AppointmentSlotStep;
  onSlotStepChange: (step: AppointmentSlotStep) => void;
  /** The calendar's month, `YYYY-MM-01` — its own, not the date's. */
  month: string;
  onMonthChange: (month: string) => void;
  today: string;
  disabled: boolean;
}

/** "Today" · "Tomorrow" · "Next week" (H:6005): a day, its month shown, the time cleared. */
function QuickDates({
  draft,
  today,
  disabled,
  onPick,
}: {
  draft: AppointmentDraft;
  today: string;
  disabled: boolean;
  onPick: (date: string) => void;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, PICKER_NS]);
  const days = { today: 0, tomorrow: 1, 'next-week': 7 } as const;
  type QuickDate = keyof typeof days;
  const options: DrawerQuickOption<QuickDate>[] = [
    { value: 'today', label: t(PICKER_KEYS.date.today, { ns: PICKER_NS }) },
    { value: 'tomorrow', label: t(PICKER_KEYS.date.tomorrow, { ns: PICKER_NS }) },
    { value: 'next-week', label: t(K.nextWeek) },
  ];
  const picked =
    options.find((option) => addCivilDays(today, days[option.value]) === draft.date)
      ?.value ?? null;
  return (
    <DrawerQuickChips
      label={t(K.title)}
      options={options}
      value={picked}
      onChange={(quick) => onPick(addCivilDays(today, days[quick]))}
      disabled={disabled}
      pickedEdge
      testId={IDS.quickDate}
    />
  );
}

/**
 * The month calendar (H:2779–2781) — the app's month grid in its `compact`
 * look: "‹ <Month YYYY> ›" — "‹" off on the current month — the two-letter
 * weekdays Sunday first (Q-A10), past days off, today and the pick in sky.
 * One tab stop: arrow keys move between days, Enter or Space picks.
 */
function BookingCalendar({
  draft,
  month,
  today,
  disabled,
  onMonthChange,
  onPick,
}: {
  draft: AppointmentDraft;
  month: string;
  today: string;
  disabled: boolean;
  onMonthChange: (month: string) => void;
  onPick: (date: string) => void;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const { formatDate } = useLocaleFormat();
  return (
    <fieldset
      aria-label={t(K.calendar)}
      data-testid={IDS.calendar}
      data-slot="booking-calendar"
      className="bg-card min-w-0 rounded-lg border p-2"
    >
      <LocalizedCalendar
        look="compact"
        tone="sky"
        mode="single"
        required
        selected={draft.date ? localDateOf(draft.date) : undefined}
        onSelect={(date) => {
          if (date) onPick(civilDateOf(date));
        }}
        month={localDateOf(month)}
        onMonthChange={(date) => onMonthChange(civilMonthStart(civilDateOf(date)))}
        startMonth={localDateOf(civilMonthStart(today))}
        today={localDateOf(today)}
        weekStartsOn={0}
        showOutsideDays={false}
        disabled={disabled ? true : { before: localDateOf(today) }}
        disableNavigation={disabled}
        labels={{
          labelDayButton: (date) =>
            formatDate(
              date,
              { weekday: 'short', day: 'numeric', month: 'short' },
              { civilDay: true },
            ),
          labelPrevious: () => t(K.previousMonth),
          labelNext: () => t(K.nextMonth),
        }}
        testIds={{
          day: IDS.calendarDay,
          previous: IDS.calendarPrevious,
          next: IDS.calendarNext,
        }}
      />
    </fieldset>
  );
}

/** "30 min" · "15 min" (H:2784): the slot grid's step. */
function SlotStepSwitch({
  step,
  disabled,
  onChange,
}: {
  step: AppointmentSlotStep;
  disabled: boolean;
  onChange: (step: AppointmentSlotStep) => void;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  return (
    <div
      role="radiogroup"
      aria-label={t(K.step)}
      data-testid={IDS.slotStep}
      className="bg-muted flex gap-0.5 rounded-lg p-0.5"
    >
      {APPOINTMENT_SLOT_STEPS.map((option) => {
        const on = option === step;
        return (
          <button // NOSONAR(S6819): styled-button radiogroup; a native radio input cannot hold this pill
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            data-slot="pill"
            onClick={() => onChange(option)}
            className={cn(
              'text-micro h-6 rounded-full px-2.5 font-medium whitespace-nowrap transition-colors',
              on
                ? 'bg-card text-foreground ring-border-strong shadow-xs ring-1'
                : 'text-muted-foreground-strong',
            )}
          >
            {t(K.stepOption, { minutes: option })}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One hour of the grid (H:2785–2787): its label — solid once a start in it is picked — and its
 * free starts (the server lists no taken ones, G3).
 */
function HourRow({
  row,
  step,
  draft,
  disabled,
  onPick,
  date,
}: {
  row: SlotHour;
  step: AppointmentSlotStep;
  draft: AppointmentDraft;
  disabled: boolean;
  onPick: (time: string) => void;
  date: string;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const slotLabel = useAppointmentSlotLabel();
  const { number, period } = hourLabel(row.hour);
  const tone = TONE_CLASSES[period === 'am' ? 'butter' : 'sky'];
  const chosen =
    draft.time !== null && row.slots.some((slot) => slot.time === draft.time);
  const periodText = t(period === 'am' ? K.am : K.pm);
  return (
    <div
      data-testid={IDS.slotHour}
      className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-1.5"
    >
      <span
        className={cn(
          'flex h-6.5 items-center gap-0.75 justify-self-start rounded-md px-1 tabular-nums',
          chosen && tone.fill,
        )}
      >
        <span className="text-body min-w-4 text-end font-semibold">{number}</span>
        <span
          className={cn(
            'rounded-md px-1.25 py-px text-[length:calc(var(--text-xs)*19/24)] font-semibold',
            chosen ? 'bg-background/22 text-background' : tone.surface,
          )}
        >
          {periodText}
        </span>
      </span>
      <div
        role="radiogroup"
        aria-label={t(K.hour, { hour: number, period: periodText })}
        className={cn('grid gap-0.75', SLOT_COLUMNS[step])}
      >
        {row.slots.map((slot) => {
          const time = slotLabel(date, slot.time).time;
          const on = draft.time === slot.time;
          return (
            <button // NOSONAR(S6819): styled-button radiogroup; a native radio input cannot hold this slot
              key={slot.time}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={time}
              title={t(K.free, { time })}
              disabled={disabled}
              data-testid={IDS.slotTime}
              data-time={slot.time}
              onClick={() => onPick(slot.time)}
              className={cn(
                'text-caption h-6.5 min-w-0 rounded-md border px-1 font-medium whitespace-nowrap tabular-nums transition-shadow',
                on
                  ? cn(tone.fill, 'border-transparent')
                  : cn('bg-card', tone.ink, tone.border, tone.selectedHover),
              )}
            >
              :{slot.time.slice(3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Each closed reason's line. */
const CLOSED_KEYS: Readonly<Record<AppointmentClosedReason, string>> = {
  past: K.closed.past,
  branch_inactive: K.closed.branchInactive,
  closed_day: K.closed.closedDay,
  holiday: K.closed.holiday,
  doctor_off: K.closed.doctorOff,
};

/**
 * The line in place of the grid: no date yet — "Pick a date to see times" —
 * a day the server closed, by its reason (past, the branch inactive, a closed
 * day, a holiday by its name, the doctor off), or an open day with no free
 * start left ("No times to book on this day"); null when the grid shows.
 */
function useSlotHint(date: string | null, slots: AppointmentSlotDay | undefined) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  if (!date) return t(K.pickDate);
  if (!slots) return null;
  if (!slots.isOpen) {
    const reason = slots.closedReason ?? 'closed_day';
    if (reason === 'holiday' && !slots.closedLabel) return t(K.closed.closedDay);
    return t(CLOSED_KEYS[reason], { label: slots.closedLabel ?? '' });
  }
  return slots.slots.length === 0 ? t(K.none) : null;
}

/**
 * Step 2 · Date & time's body (H:2777–2790; `appointments.md:83–86`): the
 * quick days, the month calendar and the slot grid — one row per hour with
 * free starts, two columns past six hours (the server computes them; no
 * struck-through taken slots, G3).
 * In a form column under 520px (480px inside the body's sides) the calendar
 * sits above the slots.
 */
export function DateTimeStep({
  draft,
  onChange,
  saved,
  slots,
  slotStep,
  onSlotStepChange,
  month,
  onMonthChange,
  today,
  disabled,
}: DateTimeStepProps) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const slotLabel = useAppointmentSlotLabel();
  const pickDate = (date: string) => {
    onChange({ kind: 'date', date });
    onMonthChange(civilMonthStart(date));
  };
  const hours = slotHours(slots?.slots ?? []);
  const columns = slotColumns(hours);
  const hint = useSlotHint(draft.date, slots);
  return (
    <div className="flex flex-col gap-2.5">
      <QuickDates draft={draft} today={today} disabled={disabled} onPick={pickDate} />
      <div className="grid grid-cols-[minmax(210px,230px)_minmax(0,1fr)] items-start gap-3 @max-[480px]:grid-cols-1">
        <BookingCalendar
          draft={draft}
          month={month}
          today={today}
          disabled={disabled}
          onMonthChange={onMonthChange}
          onPick={(date) => onChange({ kind: 'date', date })}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="me-auto text-xs font-semibold">
              {draft.date ? slotLabel(draft.date, '00:00').day : t(K.time)}
            </span>
            <SlotStepSwitch
              step={slotStep}
              disabled={disabled}
              onChange={onSlotStepChange}
            />
          </div>
          {hint === null ? (
            <div
              className={cn(
                'grid items-start gap-x-3.5 gap-y-1',
                columns.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >
              {columns.map((column) => (
                <div
                  key={column[0]?.hour ?? 'none'}
                  className="flex min-w-0 flex-col gap-0.75"
                >
                  {column.map((row) => (
                    <HourRow
                      key={row.hour}
                      row={row}
                      step={slotStep}
                      draft={draft}
                      date={draft.date ?? today}
                      disabled={disabled}
                      onPick={(time) => onChange({ kind: 'time', time, saved })}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <span data-testid={IDS.slotHint} className="text-muted-foreground text-xs">
              {hint}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
