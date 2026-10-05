import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { monthCells } from '@/shared/api/clinic/appointment-views.ts';
import {
  APPOINTMENT_SLOT_STEPS,
  type AppointmentSlot,
  type AppointmentSlotStep,
} from '@/shared/api/clinic/appointments-contracts.ts';
import {
  addCivilDays,
  addCivilMonths,
  civilMonthStart,
  localDateOf,
} from '@/shared/api/clinic/clinic-time.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerQuickChips,
  type DrawerQuickOption,
} from '@/shared/components/DrawerField/index.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/index.ts';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { ChevronLeft, ChevronRight } from '@/shared/icons/index.ts';

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

/** The calendar's pick: 24% of the sky ink over its tint (H:5999). */
const PICKED_DAY =
  'bg-[color-mix(in_oklab,var(--color-tone-sky-foreground)_24%,var(--color-tone-sky))] text-tone-sky-foreground font-semibold';

/** Props for {@link DateTimeStep}. */
export interface DateTimeStepProps {
  draft: AppointmentDraft;
  onChange: (change: AppointmentFormChange) => void;
  /** The saved slot (Edit) — a move back to it restores the status. */
  saved: SavedSlot | null;
  /** The doctor's starts that day (`availableSlots`) — undefined until a date and a doctor are set. */
  slots: readonly AppointmentSlot[] | undefined;
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
 * The month calendar (H:2779–2781): "‹ <Month YYYY> ›" — "‹" off on the
 * current month — the weekday initials Sunday first (Q-A10), past days
 * disabled, today and the pick in sky.
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
  const cells = monthCells(month);
  const sunday = addCivilDays(today, -localDateOf(today).getDay());
  const weekdays = Array.from({ length: 7 }, (_, index) => addCivilDays(sunday, index));
  const atCurrent = month <= civilMonthStart(today);
  const nav =
    'bg-card text-foreground-soft hover:bg-muted flex size-6 items-center justify-center rounded-md border transition-colors disabled:pointer-events-none disabled:opacity-50';
  return (
    <div
      role="group"
      aria-label={t(K.calendar)}
      data-testid={IDS.calendar}
      data-slot="booking-calendar"
      className="bg-card rounded-lg border p-2"
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={t(K.previousMonth)}
          title={t(K.previousMonth)}
          disabled={atCurrent || disabled}
          data-testid={IDS.calendarPrevious}
          onClick={() => onMonthChange(addCivilMonths(month, -1))}
          className={nav}
        >
          <ChevronLeft aria-hidden="true" className="size-3.5 rtl:rotate-180" />
        </button>
        <span className="text-detail font-semibold" aria-live="polite">
          {formatDate(
            localDateOf(month),
            { month: 'long', year: 'numeric' },
            { civilDay: true },
          )}
        </span>
        <button
          type="button"
          aria-label={t(K.nextMonth)}
          title={t(K.nextMonth)}
          disabled={disabled}
          data-testid={IDS.calendarNext}
          onClick={() => onMonthChange(addCivilMonths(month, 1))}
          className={nav}
        >
          <ChevronRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {weekdays.map((day) => (
          <span
            key={day}
            aria-hidden="true"
            className="text-muted-foreground flex h-5 items-center justify-center text-[length:calc(var(--text-xs)*5/6)]"
          >
            {formatDate(localDateOf(day), { weekday: 'narrow' }, { civilDay: true })}
          </span>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            // biome-ignore lint/suspicious/noArrayIndexKey: the blanks have no identity of their own
            return <span key={`blank-${index}`} aria-hidden="true" className="h-6.5" />;
          }
          const past = day < today;
          const picked = draft.date === day;
          const isToday = day === today;
          let look = 'hover:bg-muted';
          if (picked) look = PICKED_DAY;
          else if (isToday) look = cn(TONE_CLASSES.sky.surface, 'font-semibold');
          return (
            <button
              key={day}
              type="button"
              aria-pressed={picked}
              aria-label={formatDate(
                localDateOf(day),
                { weekday: 'short', day: 'numeric', month: 'short' },
                { civilDay: true },
              )}
              disabled={past || disabled}
              data-testid={IDS.calendarDay}
              data-day={day}
              onClick={() => onPick(day)}
              className={cn(
                'text-caption h-6.5 rounded-md tabular-nums transition-colors disabled:pointer-events-none',
                past ? 'text-disabled' : look,
              )}
            >
              {formatDate(localDateOf(day), { day: 'numeric' }, { civilDay: true })}
            </button>
          );
        })}
      </div>
    </div>
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
          <button
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

/** One hour of the grid (H:2785–2787): its label — solid once a start in it is picked — and its starts. */
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
      className={cn(
        'grid grid-cols-[52px_minmax(0,1fr)] items-center gap-1.5',
        row.free === 0 && 'opacity-55',
      )}
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
            <button
              key={slot.time}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={time}
              title={t(slot.free ? K.free : K.booked, { time })}
              disabled={!slot.free || disabled}
              data-testid={IDS.slotTime}
              data-time={slot.time}
              onClick={() => onPick(slot.time)}
              className={cn(
                'text-caption h-6.5 min-w-0 rounded-md border px-1 font-medium whitespace-nowrap tabular-nums transition-shadow',
                on && cn(tone.fill, 'border-transparent'),
                !on &&
                  slot.free &&
                  cn('bg-card', tone.ink, tone.border, 'hover:ring-1 hover:ring-current'),
                !slot.free &&
                  'bg-canvas text-disabled border-border cursor-not-allowed line-through',
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

/**
 * The line in place of the grid: no date yet — "Pick a date to see times" —
 * or a day the read answered with no start at all (the branch closed, the
 * doctor off, every time already passed), which says so instead of leaving
 * the space under the day blank. A full day still draws its taken slots.
 */
function slotHint(
  date: string | null,
  slots: readonly AppointmentSlot[] | undefined,
): 'pickDate' | 'none' | null {
  if (!date) return 'pickDate';
  return slots?.length === 0 ? 'none' : null;
}

/**
 * Step 2 · Date & time's body (H:2777–2790; `appointments.md:83–86`): the
 * quick days, the month calendar and the slot grid — one row per hour with
 * free starts and the taken ones struck through, two columns past six hours.
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
  const hours = slotHours(slots ?? []);
  const columns = slotColumns(hours);
  const hint = slotHint(draft.date, slots);
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
            <span className="text-muted-foreground text-xs">{t(K[hint])}</span>
          )}
        </div>
      </div>
    </div>
  );
}
