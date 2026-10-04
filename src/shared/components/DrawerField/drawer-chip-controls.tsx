import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { type AppIcon, Check } from '@/shared/icons/index.ts';

/** One chip of a {@link DrawerChips} group. */
export interface DrawerChipOption<T extends string> {
  value: T;
  label: string;
  /** The chip's tone; an untoned chip sits on `muted` in the text ink. */
  tone?: Tone;
  /** A 13px glyph before the label (the lead sources, H:1770). */
  icon?: AppIcon;
  /** The chip's hint on hover — "20 minutes", "First visit or doctor review" (the design's `title`). */
  hint?: string;
}

/**
 * How the chips look: `tone` — the drawers' 24px pills, each in its tone
 * (H:905); `outline` — 24px pills with a dashed edge, picked on `muted` with a
 * solid one (the contact preferences, H:1982); `button` — 32px buttons, plain
 * until picked, then in the tone with its ink edge (the default channel, H:1975).
 */
export type DrawerChipsVariant = 'tone' | 'outline' | 'button';

interface DrawerChipsBaseProps<T extends string> {
  /** The group's accessible name — the field's label. */
  label: string;
  options: readonly DrawerChipOption<T>[];
  variant?: DrawerChipsVariant;
  /** A control that flows on after the chips, in the same wrapping row ("+ Custom"). */
  trailing?: ReactNode;
  disabled?: boolean;
  /** Base test id; each chip is `<testId>-<value>`. */
  testId?: string;
  className?: string;
}

/** Props of a one-pick {@link DrawerChips} group (Gender, Status). */
export interface DrawerChipsSingleProps<
  T extends string,
> extends DrawerChipsBaseProps<T> {
  multiple?: false;
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tapping the picked chip clears the field (Conversion, Referrer type). */
  clearable?: boolean;
}

/** Props of a pick-any {@link DrawerChips} group (Patient type, Consent). */
export interface DrawerChipsMultipleProps<
  T extends string,
> extends DrawerChipsBaseProps<T> {
  multiple: true;
  value: readonly T[];
  /**
   * The picks in the options' order, whatever order they were tapped in — or,
   * `ordered`, in the order they were picked (a new pick goes last).
   */
  onChange: (value: T[]) => void;
  /**
   * Keep the picks in pick order: the first one picked leads (the user
   * drawer's Roles, whose first pick is the main role).
   */
  ordered?: boolean;
}

/** Props of {@link DrawerChips}. */
export type DrawerChipsProps<T extends string> =
  DrawerChipsSingleProps<T> | DrawerChipsMultipleProps<T>;

/**
 * 24px, 10px sides, 12px/500, a 1px edge in the chip's own fill (H:905): picked
 * turns the edge and a 1px ring outside it to the chip's ink, hover the edge only.
 * Each chip carries `data-slot="pill"`: the Sharp shape squares it, and the
 * focus personality draws its keyboard ring.
 */
const CHIP_CLASS =
  'inline-flex h-6 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap tabular-nums transition-[color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50';

/** `button`: 32px, `rounded-lg`, 11px sides, 13px/500 (H:1975). */
const BUTTON_CLASS =
  'inline-flex h-8 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-lg border px-2.75 text-body font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50';

/** A chip's colours for its variant, picked or not. */
function chipColours(
  variant: DrawerChipsVariant,
  tone: Tone | undefined,
  picked: boolean,
) {
  if (variant === 'outline') {
    return picked
      ? 'bg-muted text-foreground border-foreground'
      : 'bg-card text-foreground border-dashed border-border-strong hover:bg-muted';
  }
  if (variant === 'button') {
    if (!picked) return 'bg-card text-foreground border-border hover:bg-muted';
    return tone
      ? cn(TONE_CLASSES[tone].surface, 'border-current')
      : 'bg-muted text-foreground border-current';
  }
  return cn(
    tone ? TONE_CLASSES[tone].surface : 'bg-muted text-foreground',
    picked
      ? 'border-current ring-1 ring-current'
      : 'border-transparent hover:border-current',
  );
}

/**
 * The next value of a pick-any group: `value` toggled, in the options' order —
 * or in pick order when `ordered` (a new pick goes last).
 */
function toggledPicks<T extends string>(
  options: readonly DrawerChipOption<T>[],
  picks: readonly T[],
  value: T,
  ordered = false,
): T[] {
  if (ordered) {
    return picks.includes(value)
      ? picks.filter((pick) => pick !== value)
      : [...picks, value];
  }
  const next = new Set(picks);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return options.map((option) => option.value).filter((option) => next.has(option));
}

/**
 * A drawer's chip field (the design's `chips` kind, H:905): a wrapping row of
 * toggle chips in each value's tone, one pick or any number. A picked chip of
 * a pick-any group carries a 12px check; a clearable one-pick group lets the
 * picked chip be tapped off. Each chip is a button with `aria-pressed`, the
 * row a group named by the field's label.
 */
export function DrawerChips<T extends string>(props: DrawerChipsProps<T>) {
  const {
    label,
    options,
    variant = 'tone',
    trailing,
    disabled,
    testId,
    className,
  } = props;

  const isPicked = (value: T) =>
    props.multiple ? props.value.includes(value) : props.value === value;

  const toggle = (value: T) => {
    if (props.multiple) {
      props.onChange(toggledPicks(options, props.value, value, props.ordered));
      return;
    }
    if (props.value !== value) props.onChange(value);
    else if (props.clearable) props.onChange(null);
  };

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {options.map((option) => {
        const picked = isPicked(option.value);
        return (
          <button
            key={option.value}
            type="button"
            // A 32px button is not a pill: the Sharp shape leaves its corners be.
            data-slot={variant === 'button' ? 'button' : 'pill'}
            aria-pressed={picked}
            disabled={disabled}
            title={option.hint}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
            onClick={() => toggle(option.value)}
            className={cn(
              variant === 'button' ? BUTTON_CLASS : CHIP_CLASS,
              chipColours(variant, option.tone, picked),
            )}
          >
            {picked && props.multiple && variant === 'tone' ? (
              <Check aria-hidden="true" className="size-3 shrink-0" />
            ) : null}
            {option.icon ? (
              <option.icon aria-hidden="true" className="size-3.25 shrink-0" />
            ) : null}
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
      {trailing}
    </div>
  );
}
