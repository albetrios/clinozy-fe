import { type FieldValues, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { RxTiming } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import type { ItemsCellBinding } from '@/shared/forms/ItemsField/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import { RX_MEALS, RX_MORE_TIMINGS, rxDoseOf, typedText, typedValue } from './rx-form.ts';

const K = RX_KEYS;

/** The 24 × 30 taps and the SOS button share a box (H:924 `dose`). */
const TAP_CLASS =
  'text-body flex h-7.5 flex-none items-center justify-center rounded-md border tabular-nums transition-colors hover:border-disabled disabled:pointer-events-none';

const TIMES = ['morning', 'afternoon', 'night'] as const;

/** Props of the row's custom cells: the binding, and view only. */
interface RxCellProps<TForm extends FieldValues> extends ItemsCellBinding<TForm> {
  readOnly?: boolean;
}

/**
 * "Dose · M A N" (H:924; `patient-file.md:112`): three 24 × 30 taps —
 * morning, afternoon, night — each cycling 0 → 1 → 2 → 0 and lit sage, then
 * "SOS" (butter), which blanks the taps.
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
            onClick={() => {
              const next = sos ? [0, 0, 0] : [...taps];
              next[index] = (next[index] ?? 0) >= 2 ? 0 : (next[index] ?? 0) + 1;
              emit(next.some((tap) => tap > 0) ? next.join('-') : '');
            }}
            className={cn(
              TAP_CLASS,
              'w-6',
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
      <button
        type="button"
        disabled={readOnly}
        aria-pressed={sos}
        title={t(K.dose.sosHint)}
        data-testid={`${testId}-sos`}
        onClick={() => emit(sos ? '' : 'sos')}
        className={cn(
          TAP_CLASS,
          'text-tiny ms-0.5 px-1.5 font-semibold tracking-[0.02em]',
          sos
            ? cn(TONE_CLASSES.butter.surface, TONE_CLASSES.butter.border)
            : 'bg-background text-muted-foreground',
        )}
      >
        {t(K.dose.sos)}
      </button>
    </fieldset>
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
                  'px-2 text-xs font-medium whitespace-nowrap',
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
              'max-w-full min-w-7.5 gap-1 px-1.5 text-xs font-medium',
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
