import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clampNumber, readTypedNumber, sanitizeNumberText } from '@/lib/number-text.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Minus, Plus } from '@/shared/icons/index.ts';

/**
 * The 36px box a number field draws (`_patterns.md:34`; H:1592–1593): 1px
 * edge, `rounded-lg`, the card fill; its edge takes the focus ring for the
 * input inside, and a disabled field fades to 50%.
 */
const NUMBER_BOX_CLASS =
  'focus-within:border-ring focus-within:ring-ring/50 bg-background flex h-9 w-full min-w-0 items-center overflow-hidden rounded-lg border transition-[color,box-shadow] focus-within:ring-[3px] has-[input:disabled]:opacity-50 aria-invalid:border-destructive';

/** The input inside a number box: 13.5px, tabular figures, no edge of its own. */
const NUMBER_INPUT_CLASS =
  'text-field h-full w-full min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed';

/** Props of {@link DrawerNumberInput}. */
export interface DrawerNumberInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'prefix'
> {
  /** The figure as typed ("1500", "12.5", ""): the form keeps it as text. */
  value: string;
  onValueChange: (text: string) => void;
  /** A tile before the figure, e.g. "₹". */
  prefix?: string;
  /** A unit after the figure, e.g. "%". */
  suffix?: string;
  /** Digits allowed after one point (2 by default; 0 takes whole numbers only). */
  decimals?: number;
  /** A larger figure typed is capped to this (H:3811). */
  max?: number;
  /** The input's own classes — its type size, weight and alignment (Day close's ₹ figures). */
  inputClassName?: string;
}

/** A figure as text, capped at `max` when there is one. */
function cappedText(figure: number | string, max: number | undefined): string {
  const text = String(figure);
  return max !== undefined && Number.parseFloat(text) > max ? String(max) : text;
}

/**
 * The sum open in a number field (feat-write-less, D9): the box keeps what was typed while a sum is
 * open, the form takes its result at every keystroke, and leaving the field (or Enter) closes it,
 * so the box shows the result the form already holds.
 */
function useTypedSum({
  value,
  decimals,
  max,
  maxLength,
  onValueChange,
}: {
  /** The form's value now — what a sum that stops working out falls back to. */
  value: string;
  decimals: number;
  max: number | undefined;
  /** The longest plain figure; a sum is not held to it (it is never stored as typed). */
  maxLength: number | undefined;
  onValueChange: (text: string) => void;
}) {
  const [sum, setSum] = useState<{
    typed: string;
    result: number | null;
    /** The value before the sum was opened. */
    base: string;
  } | null>(null);
  const type = (raw: string) => {
    const read = readTypedNumber(raw, decimals);
    if (read.kind === 'figure') {
      setSum(null);
      const figure = maxLength === undefined ? read.text : read.text.slice(0, maxLength);
      onValueChange(cappedText(figure, max));
      return;
    }
    const base = sum?.base ?? value;
    setSum({ typed: read.typed, result: read.result, base });
    onValueChange(read.result === null ? base : cappedText(read.result, max));
  };
  const close = () => setSum(null);
  const result = sum?.result == null ? null : Number(cappedText(sum.result, max));
  return { typed: sum?.typed ?? null, result, type, close };
}

/**
 * A drawer's number field (`_patterns.md:34`; H:1592): a 36px box with an
 * optional prefix tile ("₹", `muted`) and unit ("%"), taking digits and one
 * point only and selecting its figure on focus. The value stays text, so
 * "12." can be typed; the form reads it on save.
 *
 * It also does sums (feat-write-less-2026-10-14-oixr): `1500+300`, `3x500`, `4500/3`, `1.5k`,
 * `2L` — the result shows at the box's end ("= 1,800") while the sum is open, the form holds it
 * already, and leaving the field or Enter writes it into the box. While a sum does not work out
 * (`12+`, below zero) it shows no result and the form holds the value from before the sum.
 */
export function DrawerNumberInput({
  value,
  onValueChange,
  prefix,
  suffix,
  decimals = 2,
  max,
  className,
  inputClassName,
  onFocus,
  onBlur,
  onKeyDown,
  maxLength,
  ...props
}: DrawerNumberInputProps) {
  const { formatNumber } = useLocaleFormat();
  // `maxLength` bounds a plain figure here, not on the input, so a longer sum can be typed.
  const sum = useTypedSum({ value, decimals, max, maxLength, onValueChange });
  const testId = (props as { 'data-testid'?: string })['data-testid'];
  return (
    <div
      data-slot="number-field"
      aria-invalid={props['aria-invalid']}
      className={cn(NUMBER_BOX_CLASS, className)}
    >
      {prefix ? (
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground-strong text-body flex h-full flex-none items-center border-e px-2.5"
        >
          {prefix}
        </span>
      ) : null}
      <input
        {...props}
        type="text"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={sum.typed ?? value}
        onChange={(event) => sum.type(event.target.value)}
        onFocus={(event) => {
          event.currentTarget.select();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          sum.close();
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          // Enter writes an open sum's result into the box before anything else reads it.
          if (event.key === 'Enter' && sum.typed !== null) sum.close();
          onKeyDown?.(event);
        }}
        className={cn(NUMBER_INPUT_CLASS, inputClassName)}
      />
      {sum.result !== null ? (
        <output
          data-testid={testId ? `${testId}-sum` : undefined}
          className="text-detail text-muted-foreground flex-none pe-2.5 whitespace-nowrap tabular-nums"
        >
          = {formatNumber(sum.result, { maximumFractionDigits: decimals })}
        </output>
      ) : null}
      {suffix ? (
        <span
          aria-hidden="true"
          className="text-detail text-muted-foreground flex-none pe-2.5"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/** One quick pick under a field: its label and the value it sets (a number, or a preset's id). */
export interface DrawerQuickOption<T extends string | number = number> {
  label: string;
  value: T;
}

/**
 * The quick picks under a field (H:1602) — a stepper's figures, the
 * follow-up's presets, the booking's "Today · Tomorrow · Next week": 24px
 * outline pills, 12px/500, the one matching the value on `muted` — with
 * stone's picked edge and halo too where the screen marks it (`pickedEdge`,
 * H:6005; the ink edge became stone's in change-shell-polish-and-sign-in, D7).
 */
export function DrawerQuickChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  pickedEdge = false,
  testId,
}: {
  /** The group's accessible name — the field's label. */
  label: string;
  options: readonly DrawerQuickOption<T>[];
  /** The value the picks match against; `null` matches none. */
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Edge the picked chip (stone's edge and halo — the appointment form's quick dates). */
  pickedEdge?: boolean;
  /** Base test id; each chip is `<testId>-<value>`. */
  testId?: string;
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          data-testid={testId ? `${testId}-${option.value}` : undefined}
          onClick={() => onChange(option.value)}
          data-slot="pill"
          className={cn(
            'text-foreground hover:bg-muted h-6 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-50',
            option.value === value
              ? cn('bg-muted', pickedEdge && TONE_CLASSES.stone.selected)
              : 'bg-background',
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

/** The stepper's "−" / "+" buttons: 36px, the canvas fill, a hairline toward the figure. */
const STEP_BUTTON_CLASS =
  'bg-canvas text-foreground-soft hover:bg-muted flex h-full w-9 flex-none items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-50';

/** Props of {@link DrawerStepper}. */
export interface DrawerStepperProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> {
  /** The whole number shown. */
  value: number;
  onValueChange: (value: number) => void;
  /** Lowest value — "−" stops there (0 by default). */
  min?: number;
  /** Highest value — "+" stops there and a larger figure typed is capped. */
  max?: number;
  /** The unit after the figure, e.g. "min", "days", "%". */
  suffix?: string;
  /** Quick picks under the box. */
  quick?: readonly DrawerQuickOption[];
  /** The field's name, for the quick picks' group. */
  label?: string;
  /** The "−" button's name, when "Decrease" alone is too vague ("Decrease reorder level"). */
  decreaseLabel?: string;
  /** The "+" button's name ("Increase reorder level"). */
  increaseLabel?: string;
  /** Base test id: the input, `-decrease`, `-increase` and `-quick-<value>`. */
  testId?: string;
}

/** How far each key moves a stepper (feat-write-less): ↑ ↓ one, Page Up / Page Down ten. */
const STEPPER_KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowUp: 1,
  ArrowDown: -1,
  PageUp: 10,
  PageDown: -10,
};

/**
 * A drawer's stepper (H:1593, H:1602): "−" · the figure (13.5px/500, centred,
 * typed or stepped) and its unit · "+", 36px, then optional quick picks. The
 * figure is a whole number between `min` and `max`; an empty box reads as
 * `min` once it loses focus. ↑ / ↓ step it by one and Page Up / Page Down by ten
 * (feat-write-less-2026-10-14-oixr), within the same limits.
 */
export function DrawerStepper({
  value,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  suffix,
  quick,
  label,
  decreaseLabel,
  increaseLabel,
  disabled,
  testId,
  className,
  onBlur,
  ...props
}: DrawerStepperProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const [draft, setDraft] = useState<string | null>(null);
  const set = (next: number) => onValueChange(clampNumber(next, min, max));
  const decrease = decreaseLabel ?? t(RECORD_DRAWER_KEYS.stepper.decrease);
  const increase = increaseLabel ?? t(RECORD_DRAWER_KEYS.stepper.increase);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div data-slot="stepper" className={cn(NUMBER_BOX_CLASS, className)}>
        <button
          type="button"
          aria-label={decrease}
          title={t(RECORD_DRAWER_KEYS.stepper.decrease)}
          disabled={disabled || value <= min}
          data-testid={testId ? `${testId}-decrease` : undefined}
          onClick={() => set(value - 1)}
          className={cn(STEP_BUTTON_CLASS, 'border-e')}
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <input
          {...props}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          data-testid={testId}
          value={draft ?? String(value)}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const typed = sanitizeNumberText(event.target.value, 0);
            // A figure above the maximum is capped as it is typed (H:3811).
            const text = typed !== '' && Number(typed) > max ? String(max) : typed;
            setDraft(text);
            if (text !== '') set(Number(text));
          }}
          onBlur={(event) => {
            if (draft === '') set(min);
            setDraft(null);
            onBlur?.(event);
          }}
          onKeyDown={(event) => {
            const step = STEPPER_KEY_STEPS[event.key];
            if (step === undefined || event.altKey || event.metaKey || event.ctrlKey)
              return;
            event.preventDefault();
            setDraft(null);
            set(value + step);
          }}
          // The figure is centred, so it needs no side padding — a phone's third
          // (≈94px at 375) still shows two digits between "−" and "+".
          className={cn(NUMBER_INPUT_CLASS, 'px-1 text-center font-medium')}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="text-detail text-muted-foreground flex-none pe-2.5"
          >
            {suffix}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={increase}
          title={t(RECORD_DRAWER_KEYS.stepper.increase)}
          disabled={disabled || value >= max}
          data-testid={testId ? `${testId}-increase` : undefined}
          onClick={() => set(value + 1)}
          className={cn(STEP_BUTTON_CLASS, 'border-s')}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
      {quick && quick.length > 0 ? (
        <DrawerQuickChips
          label={label ?? ''}
          options={quick}
          value={value}
          onChange={set}
          disabled={disabled}
          testId={testId ? `${testId}-quick` : undefined}
        />
      ) : null}
    </div>
  );
}
