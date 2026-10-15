import { type ReactElement, type ReactNode, type Ref, useId, useState } from 'react';
import { type FieldError, type FieldValues, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  cellNumber,
  clampNumber,
  MONEY_SCALE,
  numberFromText,
  sanitizeNumberText,
  textFromNumber,
} from '@/lib/number-text.ts';
import { cn } from '@/lib/utils.ts';
import {
  Picker,
  type PickerOption,
  type PickerSingleProps,
} from '@/shared/components/Picker/index.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { Minus, Plus } from '@/shared/icons/index.ts';

import {
  ITEMS_FIELD_KEYS,
  ITEMS_FIELD_NS,
  ITEMS_QTY_MAX,
} from './items-field.constants.ts';
import type { ItemsCellBinding } from './items-field.types.ts';

/*
 * The cells of an items row (H:924, the prototype's `qty` · `input` · `pick`
 * kinds), each bound to one field of the row through `row.bind(key)`. A
 * field's message — a Zod issue, or a 422 mapped onto `items.<n>.<key>` by
 * `mapValidationErrors` — shows on its cell: a red edge, the tooltip from `md`
 * up and the spoken description. They render inside an `ItemsField`.
 */

/** A 32px cell input: `rounded-md`, 8px sides, 13px tabular figures. */
const CELL_INPUT_CLASS =
  'h-8 rounded-md px-2 text-body tabular-nums shadow-none md:text-body';

/** The stepper: one 32px box, its edge taking the focus ring for the input inside. */
const STEPPER_CLASS =
  'focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex h-8 w-full min-w-0 items-center overflow-hidden rounded-md border focus-within:ring-[3px]';
const STEP_BUTTON_CLASS =
  'bg-canvas text-foreground-soft hover:bg-muted flex h-full w-6 shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-50';
const STEPPER_INPUT_CLASS =
  'text-body h-full w-full min-w-0 flex-1 bg-transparent px-0.5 text-center font-medium tabular-nums outline-none';
/**
 * The stepper on a touch screen, when its row asks (`largeOnTouch`): a 44px
 * box with 44px buttons and 16px marks — finger-size, like the row's chips.
 */
const STEPPER_TOUCH = {
  box: 'pointer-coarse:h-11',
  button: 'pointer-coarse:w-11',
  icon: 'pointer-coarse:size-4',
} as const;
/** The stepper's classes for a row that does not ask: no change on touch. */
const STEPPER_NO_TOUCH = { box: '', button: '', icon: '' } as const;

/**
 * A cell's message as the tooltip (H:3811 `badTip`): shown from `md` up, never
 * on a phone, where the red edge and the screen's save toast carry it. Always
 * mounted, so a message coming or going never remounts the control.
 */
function CellMessage({
  message,
  children,
}: {
  message?: string;
  children: ReactElement;
}) {
  return (
    <Tooltip open={message ? undefined : false}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {message ? <TooltipContent>{message}</TooltipContent> : null}
    </Tooltip>
  );
}

/**
 * A cell's stored message — a save's "Enter the rate" (`setError`) or a 422
 * mapped onto the row — until that cell is edited: fixing the figure takes the
 * red edge away, and the next failed save sets, and shows, a fresh one.
 */
function useCellError(stored: FieldError | undefined) {
  const [edited, setEdited] = useState<FieldError | undefined>(undefined);
  return {
    message: stored && stored !== edited ? stored.message : undefined,
    /** The cell changed: its stored message no longer describes it. */
    edit: () => setEdited(stored),
  };
}

/** The message, spoken with the control it describes (`aria-describedby`). */
function CellMessageText({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="sr-only">
      {message}
    </span>
  ) : null;
}

/** Props of {@link ItemsNumberInput}. */
export interface ItemsNumberInputProps {
  /** The value in the field's own unit: paise for money. */
  value: number;
  onValueChange: (value: number) => void;
  /** Accessible name: the column's header. */
  label: string;
  /** Rupees typed, paise stored: two decimals and the "₹ 0" placeholder. */
  money?: boolean;
  /** Digits a plain number takes after the point; 0 (whole numbers) by default. */
  decimals?: number;
  /** The largest value, in the field's own unit (Disc % 100); a larger figure is capped. */
  max?: number;
  /** Shown while empty: "0", or "₹ 0" for money. */
  placeholder?: string;
  /** 9 characters by default. */
  maxLength?: number;
  /** Numbers sit at the inline end by default. */
  align?: 'start' | 'end';
  /** The validation message: a red edge, the tooltip and the spoken description. */
  error?: string;
  readOnly?: boolean;
  onBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
  testId?: string;
  /**
   * Classes for the input, over the 32px cell's — a host that sizes the cell to
   * its own row (the suggestions card's 112×30 price box, H:2809).
   */
  className?: string;
}

/**
 * A number cell that is not a form field of its own (H:3811, `input` with
 * `num`) — the invoice's Final, whose typing back-solves the discount. A
 * field uses {@link ItemsNumberCell}. Only digits (and, with `decimals`, one
 * point) are taken; what is typed stays as typed while focused ("12.",
 * "0.5"), and at rest the cell shows the value — empty for 0, under its
 * placeholder.
 */
export function ItemsNumberInput({
  value,
  onValueChange,
  label,
  money = false,
  decimals,
  max,
  placeholder,
  maxLength = 9,
  align = 'end',
  error,
  readOnly,
  onBlur,
  ref,
  testId,
  className,
}: ItemsNumberInputProps) {
  const { t } = useTranslation(ITEMS_FIELD_NS);
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const scale = money ? MONEY_SCALE : 1;
  const places = decimals ?? (money ? 2 : 0);

  const change = (typed: string) => {
    const text = sanitizeNumberText(typed, places);
    const next = numberFromText(text, scale, money ? 0 : places);
    if (max !== undefined && next > max) {
      setDraft(textFromNumber(max, scale, places));
      onValueChange(max);
      return;
    }
    setDraft(text);
    onValueChange(next);
  };

  return (
    <>
      <CellMessage message={error}>
        <Input
          ref={ref}
          type="text"
          inputMode={places > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={draft ?? textFromNumber(value, scale, places)}
          placeholder={
            placeholder ?? (money ? t(ITEMS_FIELD_KEYS.moneyPlaceholder) : '0')
          }
          maxLength={maxLength}
          readOnly={readOnly}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-testid={testId}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => change(event.target.value)}
          onBlur={() => {
            setDraft(null);
            onBlur?.();
          }}
          className={cn(CELL_INPUT_CLASS, align === 'end' && 'text-end', className)}
        />
      </CellMessage>
      <CellMessageText id={errorId} message={error} />
    </>
  );
}

/** Props of {@link ItemsNumberCell}: a binding (`row.bind('rate')`) and the number's shape. */
export type ItemsNumberCellProps<TForm extends FieldValues> = ItemsCellBinding<TForm> &
  Omit<
    ItemsNumberInputProps,
    'value' | 'onValueChange' | 'onBlur' | 'ref' | 'label' | 'testId'
  >;

/**
 * A number field of a row (H:3811): Rate, Disc %, Amount, a batch's Qty. The
 * field holds a number in its own unit — paise with `money` — and empty is 0.
 */
export function ItemsNumberCell<TForm extends FieldValues>({
  control,
  name,
  label,
  testId,
  error,
  ...shape
}: ItemsNumberCellProps<TForm>) {
  const {
    field: { ref, value, onChange, onBlur },
    fieldState,
  } = useController({ control, name });
  const stored = useCellError(fieldState.error);
  return (
    <ItemsNumberInput
      {...shape}
      ref={ref}
      label={label}
      testId={testId}
      value={cellNumber(value)}
      onValueChange={(next) => {
        stored.edit();
        onChange(next);
      }}
      onBlur={onBlur}
      error={error ?? stored.message}
    />
  );
}

/** Props of {@link ItemsTextCell}. */
export interface ItemsTextCellProps<
  TForm extends FieldValues,
> extends ItemsCellBinding<TForm> {
  placeholder?: string;
  maxLength?: number;
  /** Text starts at the inline start by default. */
  align?: 'start' | 'end';
  /** A message of the screen's own, over the field's validation. */
  error?: string;
  readOnly?: boolean;
}

/** A text field of a row (H:3811 `input`): a batch number, an expiry "MM/YY". */
export function ItemsTextCell<TForm extends FieldValues>({
  control,
  name,
  label,
  testId,
  placeholder,
  maxLength,
  align = 'start',
  error,
  readOnly,
}: ItemsTextCellProps<TForm>) {
  const {
    field: { ref, value, onChange, onBlur },
    fieldState,
  } = useController({ control, name });
  const errorId = useId();
  const stored = useCellError(fieldState.error);
  const message = error ?? stored.message;
  return (
    <>
      <CellMessage message={message}>
        <Input
          ref={ref}
          name={name}
          type="text"
          autoComplete="off"
          value={typeof value === 'string' ? value : ''}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={readOnly}
          aria-label={label}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          data-testid={testId}
          onChange={(event) => {
            stored.edit();
            onChange(event.target.value);
          }}
          onBlur={onBlur}
          className={cn(CELL_INPUT_CLASS, align === 'end' && 'text-end')}
        />
      </CellMessage>
      <CellMessageText id={errorId} message={message} />
    </>
  );
}

/** Props of {@link ItemsQtyCell}. */
export interface ItemsQtyCellProps<
  TForm extends FieldValues,
> extends ItemsCellBinding<TForm> {
  /** 1 by default: "−" stops there, and an emptied count comes back to it. */
  min?: number;
  /** `ITEMS_QTY_MAX` (9,999) by default (H:3811); the invoice's 1–999 passes 999. */
  max?: number;
  /** A message of the screen's own, over the field's validation. */
  error?: string;
  readOnly?: boolean;
  /**
   * On a touch screen (a coarse pointer) the box is 44px high and its buttons
   * 44px wide — for a row whose other controls are 44px there (the Rx line's
   * chips). Off by default: a table opts in once it is laid out for it.
   */
  largeOnTouch?: boolean;
}

/**
 * The quantity stepper of a row (H:924 `qty`): one 32px box of "−" · the
 * count · "+", the buttons on `canvas` — 44px on touch with `largeOnTouch`.
 * It is a spin button — ↑ / ↓ step it, typing replaces the count (selected
 * on focus), and a count left empty or below `min` returns to `min` on blur —
 * so its two buttons stay out of the tab order.
 */
export function ItemsQtyCell<TForm extends FieldValues>({
  control,
  name,
  label,
  testId,
  min = 1,
  max = ITEMS_QTY_MAX,
  error,
  readOnly = false,
  largeOnTouch = false,
}: ItemsQtyCellProps<TForm>) {
  const { t } = useTranslation(ITEMS_FIELD_NS);
  const touch = largeOnTouch ? STEPPER_TOUCH : STEPPER_NO_TOUCH;
  const {
    field: { ref, value: stored, onChange, onBlur },
    fieldState,
  } = useController({ control, name });
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const value = cellNumber(stored);
  const storedError = useCellError(fieldState.error);
  const message = error ?? storedError.message;

  const step = (next: number) => {
    storedError.edit();
    setDraft(null);
    onChange(clampNumber(next, min, max));
  };

  const type = (typed: string) => {
    storedError.edit();
    const text = typed.replace(/\D/g, '');
    if (text === '') {
      setDraft('');
      return;
    }
    const count = Math.min(Number(text), max);
    setDraft(String(count));
    if (count >= min) onChange(count);
  };

  const leave = () => {
    if (draft !== null && (draft === '' || Number(draft) < min)) onChange(min);
    setDraft(null);
    onBlur();
  };

  return (
    <>
      <div
        data-touch-size={largeOnTouch ? 'large' : undefined}
        className={cn(STEPPER_CLASS, touch.box, message && 'border-destructive')}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={t(ITEMS_FIELD_KEYS.decrease)}
          disabled={readOnly || value <= min}
          onClick={() => step(value - 1)}
          data-testid={`${testId}-decrease`}
          className={cn(STEP_BUTTON_CLASS, touch.button)}
        >
          <Minus aria-hidden="true" className={cn('size-3.5', touch.icon)} />
        </button>
        <CellMessage message={message}>
          <input
            ref={ref}
            name={name}
            type="text"
            role="spinbutton"
            inputMode="numeric"
            autoComplete="off"
            maxLength={String(max).length}
            value={draft ?? String(value)}
            readOnly={readOnly}
            aria-label={label}
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            data-testid={testId}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => type(event.target.value)}
            onBlur={leave}
            onKeyDown={(event) => {
              if (readOnly) return;
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                step(value + 1);
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                step(value - 1);
              }
            }}
            className={STEPPER_INPUT_CLASS}
          />
        </CellMessage>
        <button
          type="button"
          tabIndex={-1}
          aria-label={t(ITEMS_FIELD_KEYS.increase)}
          disabled={readOnly || value >= max}
          onClick={() => step(value + 1)}
          data-testid={`${testId}-increase`}
          className={cn(STEP_BUTTON_CLASS, touch.button)}
        >
          <Plus aria-hidden="true" className={cn('size-3.5', touch.icon)} />
        </button>
      </div>
      <CellMessageText id={errorId} message={message} />
    </>
  );
}

/** Props of {@link ItemsPickerCell}: a binding and the picker's options, static or remote. */
export type ItemsPickerCellProps<
  TForm extends FieldValues,
  TOption = unknown,
> = ItemsCellBinding<TForm> &
  Omit<
    PickerSingleProps<TOption>,
    | 'value'
    | 'onChange'
    | 'label'
    | 'size'
    | 'testId'
    | 'multiple'
    | 'invalid'
    | 'id'
    | 'aria-describedby'
    | 'className'
  > & {
    /** After a pick or a clear: the screen fills the row's other fields (name, rate, GST). */
    onPick?: (option: PickerOption<TOption> | null) => void;
    /** A message of the screen's own, over the field's validation. */
    error?: string;
  };

/**
 * The item picker of a row (H:924 `pick`): the one picker at 32px (`sm`) over
 * a field that holds the option's key — an offering, a medicine, a clinic
 * item, a payment mode. Static `options` are searched in place; `loadOptions`
 * pages a remote list. `onPick` hands the option back so the screen fills the
 * row with its form's `setValue`.
 */
export function ItemsPickerCell<TForm extends FieldValues, TOption = unknown>({
  control,
  name,
  label,
  testId,
  onPick,
  error,
  ...picker
}: ItemsPickerCellProps<TForm, TOption>) {
  const {
    field: { ref, value, onChange, onBlur },
    fieldState,
  } = useController({ control, name });
  const errorId = useId();
  const stored = useCellError(fieldState.error);
  const message = error ?? stored.message;
  // RHF focuses a field through its ref (a new row, the first error on submit):
  // point it at the picker's trigger.
  const registerFocus = (node: HTMLDivElement | null) => {
    ref(node ? { focus: () => node.querySelector('button')?.focus() } : null);
  };

  return (
    <>
      <CellMessage message={message}>
        <div ref={registerFocus} className="w-full min-w-0">
          <Picker<TOption>
            {...picker}
            size="sm"
            label={label}
            testId={testId}
            value={typeof value === 'string' ? value : null}
            invalid={Boolean(message)}
            aria-describedby={message ? errorId : undefined}
            onChange={(key, option) => {
              stored.edit();
              onChange(key);
              onBlur();
              onPick?.(option);
            }}
          />
        </div>
      </CellMessage>
      <CellMessageText id={errorId} message={message} />
    </>
  );
}

/** Props of {@link ItemsReadCell}. */
export interface ItemsReadCellProps {
  children: ReactNode;
  /** The row's own name or figure, in full weight; the rest are muted. */
  strong?: boolean;
  className?: string;
}

/**
 * A read-only cell's text — a view's rows (a supplier's Account, a sale's
 * medicines, a received order's lines): 13px on one line with tabular
 * figures, the row's own name or figure in full weight, the rest muted.
 */
export function ItemsReadCell({
  children,
  strong = false,
  className,
}: ItemsReadCellProps) {
  return (
    <span
      className={cn(
        'text-body min-w-0 truncate tabular-nums',
        strong ? 'text-foreground font-medium' : 'text-muted-foreground-strong',
        className,
      )}
    >
      {children}
    </span>
  );
}
