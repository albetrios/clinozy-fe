import { useState } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { RxTiming } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import type { ItemsCellBinding } from '@/shared/forms/ItemsField/index.ts';
import { ChevronDown, Minus, Plus } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import {
  RX_DAY_PRESETS,
  RX_DOSE_PRESETS,
  RX_MAX_TAP,
  RX_MEALS,
  RX_MORE_TIMINGS,
  rxDoseOf,
  rxSteppedDose,
  rxToggledDose,
  rxTypedDays,
  typedText,
  typedValue,
} from './rx-form.ts';

const K = RX_KEYS;

/**
 * The row's own taps and buttons share a box (H:924 `dose`): 30px high — 36px
 * on a touch screen, where a finger needs the room (change-prescription-writing §6.1).
 */
const TAP_CLASS =
  'text-body flex h-7.5 flex-none items-center justify-center rounded-md border tabular-nums transition-colors hover:border-disabled disabled:pointer-events-none pointer-coarse:h-9';

const TIMES = ['morning', 'afternoon', 'night'] as const;

/** The Days list's "No days" row. */
const NO_DAYS = 'none';

/** Props of the row's custom cells: the binding, and view only. */
interface RxCellProps<TForm extends FieldValues> extends ItemsCellBinding<TForm> {
  readOnly?: boolean;
}

/** A common dose in the ⌄: its value ("1-0-1", SOS) over its words ("Twice a day"). */
function DosePreset({
  preset,
  selected,
  onPick,
  testId,
}: {
  preset: (typeof RX_DOSE_PRESETS)[number];
  selected: boolean;
  onPick: () => void;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const sos = preset.id === 'sos';
  // SOS lights butter, as its taps' stand-in does; a dose lights sage, as a tap does.
  const tone = TONE_CLASSES[sos ? 'butter' : 'sage'];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      data-testid={sos ? `${testId}-sos` : `${testId}-preset-${preset.id}`}
      className={cn(
        'hover:border-disabled flex min-h-11 flex-col items-start justify-center rounded-md border px-2.5 py-1 text-start transition-colors',
        selected ? cn(tone.surface, tone.border) : 'bg-background',
      )}
    >
      <span className="text-body font-semibold tabular-nums">
        {sos ? t(K.dose.sos) : preset.value}
      </span>
      <span className="text-caption text-muted-foreground">
        {t(K.dose.presetNames[preset.id])}
      </span>
    </button>
  );
}

/** One time of day in the ⌄: its name, − its count +. */
function DoseStepper({
  time,
  count,
  onStep,
  testId,
}: {
  time: (typeof TIMES)[number];
  count: number;
  onStep: (step: 1 | -1) => void;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const label = t(K.dose.times[time]);
  return (
    <div className="flex items-center gap-2">
      <span className="text-detail flex-1">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={count <= 0}
        aria-label={t(K.dose.less, { time: label })}
        onClick={() => onStep(-1)}
        data-testid={`${testId}-${time}-less`}
        className="shadow-none pointer-coarse:size-9"
      >
        <Minus aria-hidden="true" className="size-3.5" />
      </Button>
      <span
        aria-live="polite"
        data-testid={`${testId}-${time}-count`}
        className="text-body w-5 text-center font-semibold tabular-nums"
      >
        {count}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={count >= RX_MAX_TAP}
        aria-label={t(K.dose.more, { time: label })}
        onClick={() => onStep(1)}
        data-testid={`${testId}-${time}-more`}
        className="shadow-none pointer-coarse:size-9"
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </Button>
    </div>
  );
}

/**
 * The ⌄ beside the taps (change-prescription-writing D5): the common doses in
 * words — one tap sets one and closes — then each time's − / + for more than
 * one tablet, and Clear. A set SOS shows on the ⌄ itself, butter.
 */
function DoseMenu({
  value,
  onValue,
  readOnly,
  testId,
}: {
  value: string;
  onValue: (value: string) => void;
  readOnly: boolean;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const [open, setOpen] = useState(false);
  const sos = value === 'sos';
  const dose = rxDoseOf(value);
  const taps = Array.isArray(dose) ? dose : [0, 0, 0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={readOnly}
          aria-label={sos ? `${t(K.dose.presets)} · ${t(K.dose.sos)}` : t(K.dose.presets)}
          title={t(K.dose.presetsHint)}
          data-testid={`${testId}-presets`}
          className={cn(
            TAP_CLASS,
            'ms-0.5 min-w-6.5 gap-0.5 px-1 pointer-coarse:min-w-9',
            sos
              ? cn(
                  TONE_CLASSES.butter.surface,
                  TONE_CLASSES.butter.border,
                  'text-tiny px-1.5 font-semibold tracking-[0.02em]',
                )
              : cn('bg-background text-foreground-soft', open && 'bg-muted'),
          )}
        >
          {sos ? <span>{t(K.dose.sos)}</span> : null}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 flex-none transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        data-testid={`${testId}-presets-panel`}
        className="flex w-68 flex-col gap-3 p-3"
      >
        <section aria-label={t(K.dose.presets)} className="flex flex-col gap-1.5">
          <h4 className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
            {t(K.dose.presets)}
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {RX_DOSE_PRESETS.map((preset) => (
              <DosePreset
                key={preset.id}
                preset={preset}
                selected={value === preset.value}
                testId={testId}
                onPick={() => {
                  onValue(value === preset.value ? '' : preset.value);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </section>
        <section aria-label={t(K.dose.counts)} className="flex flex-col gap-1.5">
          <h4 className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
            {t(K.dose.counts)}
          </h4>
          {TIMES.map((time, index) => (
            <DoseStepper
              key={time}
              time={time}
              count={taps[index] ?? 0}
              testId={testId}
              onStep={(step) => onValue(rxSteppedDose(value, index, step))}
            />
          ))}
        </section>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onValue('');
              setOpen(false);
            }}
            data-testid={`${testId}-clear`}
            className="text-muted-foreground self-start"
          >
            {t(K.dose.clear)}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * "Dose" (H:924; `patient-file.md:112`; change-prescription-writing D5):
 * morning, afternoon and night — one tap turns a time on (1, lit sage) and
 * off — then the ⌄ with the common doses, SOS and two or more tablets.
 */
export function RxDoseCell<TForm extends FieldValues>({
  control,
  name,
  testId,
  readOnly = false,
  onValue,
}: RxCellProps<TForm> & { onValue?: (dose: string) => void }) {
  const { t } = useTranslation(RX_NS);
  const { field } = useController({ control, name });
  const value = String(field.value ?? '');
  const sos = value === 'sos';
  const dose = rxDoseOf(value);
  const taps = Array.isArray(dose) ? [...dose] : [0, 0, 0];
  const emit = (next: string) => {
    field.onChange(next);
    onValue?.(next);
  };

  return (
    <fieldset
      aria-label={t(K.dose.group)}
      className="m-0 flex min-w-0 items-center gap-0.75 border-0 p-0"
    >
      {TIMES.map((time, index) => {
        const count = taps[index] ?? 0;
        const on = !sos && count > 0;
        const label = t(K.dose.times[time]);
        return (
          <button
            key={time}
            type="button"
            disabled={readOnly}
            aria-pressed={on}
            aria-label={`${label} · ${count}`}
            title={
              on
                ? t(K.dose.on, { time: label, taps: count })
                : t(K.dose.off, { time: label })
            }
            data-testid={`${testId}-${time}`}
            onClick={() => emit(rxToggledDose(value, index))}
            className={cn(
              TAP_CLASS,
              'w-6.5 pointer-coarse:w-8.5',
              on
                ? cn(TONE_CLASSES.sage.surface, TONE_CLASSES.sage.border, 'font-semibold')
                : 'bg-background',
              !on && (sos ? 'text-border-strong' : 'text-disabled'),
            )}
          >
            {sos ? '·' : count}
          </button>
        );
      })}
      <DoseMenu value={value} onValue={emit} readOnly={readOnly} testId={testId} />
    </fieldset>
  );
}

/**
 * "Days" (change-prescription-writing D6): the shared picker — the usual
 * courses, any number typed (1–365) with "Use", and "No days" first once a
 * course is set. A change hands
 * the days back so the row's quantity follows (days × doses a day).
 */
export function RxDaysCell<TForm extends FieldValues>({
  control,
  name,
  label,
  testId,
  readOnly = false,
  onValue,
}: RxCellProps<TForm> & { onValue?: (days: number | null) => void }) {
  const { t } = useTranslation(RX_NS);
  const { field } = useController({ control, name });
  const days = typeof field.value === 'number' && field.value > 0 ? field.value : null;
  const optionOf = (count: number): PickerOption => ({
    key: String(count),
    label: t(K.daysNote, { count }),
    leading: { kind: 'none' },
  });
  const options: PickerOption[] = [
    // A set course clears from the list's first row — the cell keeps its room for the days.
    ...(days === null
      ? []
      : [{ key: NO_DAYS, label: t(K.items.noDays), leading: { kind: 'none' as const } }]),
    ...RX_DAY_PRESETS.map(optionOf),
    ...(days !== null && !(RX_DAY_PRESETS as readonly number[]).includes(days)
      ? [optionOf(days)]
      : []),
  ];
  const emit = (next: number | null) => {
    field.onChange(next);
    onValue?.(next);
  };

  return (
    <Picker
      size="sm"
      label={label}
      placeholder={label}
      searchPlaceholder={t(K.items.searchDays)}
      options={options}
      value={days === null ? null : String(days)}
      onChange={(key) => emit(key && key !== NO_DAYS ? Number(key) : null)}
      onCreate={(query) => {
        const typed = rxTypedDays(query);
        if (typed !== null) emit(typed);
      }}
      createLabel={t(K.items.use)}
      searchable
      minWidth={200}
      disabled={readOnly}
      testId={testId}
      className="w-full"
    />
  );
}

/**
 * "Meal" (H:924 `seg`; `patient-file.md:112`): "Before" (butter) and "After"
 * (sky) — a second tap clears — then ⌄ "More timings" (the contract's
 * `rx_timing`, or a timing typed with "Use"); a picked timing stands in for
 * the two buttons, lav, and its button changes it.
 */
export function RxWhenCell<TForm extends FieldValues>({
  control,
  name,
  testId,
  readOnly = false,
}: RxCellProps<TForm>) {
  const { t } = useTranslation(RX_NS);
  const { field } = useController({ control, name });
  const value = String(field.value ?? '');
  const typed = typedText(value);
  const timing = (RX_MORE_TIMINGS as readonly string[]).includes(value)
    ? (value as RxTiming)
    : null;
  let picked: string | null = null;
  if (timing) picked = t(K.timings[timing]);
  else if (typed !== null) picked = typed;

  const options: PickerOption[] = [
    ...RX_MORE_TIMINGS.map((key) => ({ key, label: t(K.timings[key]) })),
    ...(typed !== null ? [{ key: value, label: typed }] : []),
  ];

  return (
    <div className="flex max-w-full min-w-0 items-center gap-0.75 overflow-hidden">
      {picked
        ? null
        : RX_MEALS.map((meal) => {
            const on = value === meal.value;
            return (
              <button
                key={meal.value}
                type="button"
                disabled={readOnly}
                aria-pressed={on}
                title={t(meal.value === 'before' ? K.meal.beforeHint : K.meal.afterHint)}
                data-testid={`${testId}-${meal.value}`}
                onClick={() => field.onChange(on ? '' : meal.value)}
                className={cn(
                  TAP_CLASS,
                  'px-2 text-xs font-medium whitespace-nowrap pointer-coarse:px-3',
                  on
                    ? cn(TONE_CLASSES[meal.tone].surface, TONE_CLASSES[meal.tone].border)
                    : 'bg-background text-foreground-soft',
                )}
              >
                {t(meal.value === 'before' ? K.meal.before : K.meal.after)}
              </button>
            );
          })}
      <Picker
        label={t(K.meal.more)}
        options={options}
        value={timing ?? (typed !== null ? value : null)}
        onChange={(key) => field.onChange(key ?? '')}
        onCreate={(query) => {
          const text = query.trim().slice(0, 40);
          if (text) field.onChange(typedValue(text));
        }}
        createLabel={t(K.items.use)}
        searchable
        minWidth={200}
        disabled={readOnly}
        testId={`${testId}-more`}
        className="min-w-0 flex-[0_1_auto]"
        renderTrigger={({ open }) => (
          <button
            type="button"
            aria-label={t(K.meal.more)}
            title={picked ? t(K.meal.change, { timing: picked }) : t(K.meal.more)}
            data-testid={`${testId}-more`}
            className={cn(
              TAP_CLASS,
              'max-w-full min-w-7.5 gap-1 px-1.5 text-xs font-medium pointer-coarse:min-w-9',
              picked
                ? cn(TONE_CLASSES.lav.surface, TONE_CLASSES.lav.border)
                : cn('bg-background text-foreground-soft', open && 'bg-muted'),
            )}
          >
            {picked ? <span className="min-w-0 truncate">{picked}</span> : null}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-3.5 flex-none transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </button>
        )}
      />
    </div>
  );
}
