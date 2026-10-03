import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import { PICKER_TRIGGER_SIZE_CLASSES } from '@/shared/components/Picker/picker.constants.ts';
import type {
  PickerOption,
  PickerSize,
} from '@/shared/components/Picker/picker.types.ts';
import { toneForLabel } from '@/shared/components/Picker/picker-tone.ts';
import {
  PickerAvatar,
  PickerDot,
  PickerPill,
} from '@/shared/components/Picker/picker-visuals.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { ChevronDown, X } from '@/shared/icons/index.ts';

/** Where the trigger's text starts: 12px, 10px for `sm`, 7px beside an avatar chip. */
export type PickerTriggerInset = 'default' | 'compact' | 'avatar';

const INSET_CLASSES: Record<PickerTriggerInset, string> = {
  default: 'ps-3',
  compact: 'ps-2.5',
  avatar: 'ps-1.75',
};

/** Props for {@link PickerTrigger}. */
export interface PickerTriggerProps extends ComponentProps<'button'> {
  size?: PickerSize;
  inset?: PickerTriggerInset;
  /** Multi-select chips wrap and the trigger grows. */
  wrap?: boolean;
  /** Reserve the room the clear × sits in. */
  reserveClear?: boolean;
  /** A leading glyph (the date and time fields). */
  icon?: ReactNode;
}

/**
 * The field-style trigger (H:904): 32 / 36 / 44px, `rounded-lg`, a border that
 * turns `disabled` with the focus ring while open, and a 14px chevron that
 * turns over. Built on `Button` so it carries the platform focus ring; every
 * prop (the popover's wiring included) lands on the button.
 */
export function PickerTrigger({
  size = 'md',
  inset = 'default',
  wrap = false,
  reserveClear = false,
  icon,
  className,
  children,
  ...props
}: PickerTriggerProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'group/picker-trigger bg-background text-foreground hover:border-muted-foreground hover:bg-background hover:text-foreground dark:hover:bg-background aria-expanded:border-disabled aria-expanded:ring-ring/50 h-auto w-full justify-start gap-2 rounded-lg border px-0 pe-2.5 text-start font-normal shadow-(--elevation-control) aria-expanded:ring-[3px]',
        PICKER_TRIGGER_SIZE_CLASSES[size],
        INSET_CLASSES[inset],
        wrap ? 'py-1.25 whitespace-normal' : 'py-0',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="text-muted-foreground flex shrink-0">
          {icon}
        </span>
      ) : null}
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden',
          wrap && 'flex-wrap',
        )}
      >
        {children}
      </span>
      {reserveClear ? <span aria-hidden="true" className="w-5 shrink-0" /> : null}
      <span
        aria-hidden="true"
        className="text-muted-foreground flex shrink-0 transition-transform duration-150 group-aria-expanded/picker-trigger:rotate-180"
      >
        <ChevronDown className="size-3.5" />
      </span>
    </Button>
  );
}

/** Props for {@link PickerTriggerClear}. */
export interface PickerTriggerClearProps {
  label: string;
  onClear: () => void;
  testId?: string;
}

/**
 * The trigger's 20px clear ×. It sits over the end of the trigger, beside the
 * chevron, as a sibling button — a button inside the trigger would nest one
 * control in another. Render it inside the trigger's `relative` wrapper.
 */
export function PickerTriggerClear({ label, onClear, testId }: PickerTriggerClearProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onClear}
      className="text-muted-foreground hover:bg-muted hover:text-foreground absolute end-8 top-1/2 size-5 -translate-y-1/2 rounded-md"
    >
      <X className="size-3.25" />
    </Button>
  );
}

function PickerChip<T>({ option }: { option: PickerOption<T> }) {
  const tone = option.tone ?? toneForLabel(option.label);
  const leading = option.leading;
  if (leading?.kind === 'avatar') {
    return (
      <span
        data-slot="pill"
        className="bg-background text-foreground text-detail inline-flex h-7 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5 font-medium whitespace-nowrap"
      >
        <PickerAvatar initials={leading.initials} tone={tone} variant="chip" />
        <span className="truncate">{option.label}</span>
      </span>
    );
  }
  const icon =
    leading?.kind === 'pill' || leading?.kind === 'icon' ? leading.icon : undefined;
  return (
    <PickerPill tone={tone} icon={icon} variant="chip">
      {option.label}
    </PickerPill>
  );
}

function PickerPlainValue<T>({
  option,
  size,
}: {
  option: PickerOption<T>;
  size: PickerSize;
}) {
  const leading = option.leading ?? { kind: 'dot' };
  const Icon = leading.kind === 'icon' ? leading.icon : undefined;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {leading.kind === 'dot' ? (
        <PickerDot tone={option.tone ?? toneForLabel(option.label)} variant="trigger" />
      ) : null}
      {Icon ? (
        <Icon
          aria-hidden="true"
          className="text-muted-foreground-strong size-3.5 shrink-0"
        />
      ) : null}
      <span className="truncate">{option.label}</span>
      {option.meta && size !== 'sm' ? (
        <span className="text-caption text-muted-foreground shrink-0 tabular-nums">
          {option.meta}
        </span>
      ) : null}
    </span>
  );
}

/** Props for {@link PickerValue}. */
export interface PickerValueProps<T> {
  selected: readonly PickerOption<T>[];
  multiple: boolean;
  size: PickerSize;
  placeholder: string;
  /** Chips shown before "+N". */
  maxChips: number;
}

/**
 * What the trigger shows: the placeholder; one pick as its dot, icon or chip
 * (a person is an avatar chip); several picks as up to `maxChips` tone chips
 * then a "+N" count.
 */
export function PickerValue<T>({
  selected,
  multiple,
  size,
  placeholder,
  maxChips,
}: PickerValueProps<T>) {
  const { formatNumber } = useLocaleFormat();
  const [first] = selected;
  if (!first) {
    return <span className="text-muted-foreground truncate">{placeholder}</span>;
  }
  if (multiple) {
    const hidden = selected.length - maxChips;
    return (
      <>
        {selected.slice(0, maxChips).map((option) => (
          <PickerChip key={option.key} option={option} />
        ))}
        {hidden > 0 ? (
          <span
            data-slot="pill"
            className="bg-muted text-muted-foreground-strong inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-medium tabular-nums"
          >
            +{formatNumber(hidden)}
          </span>
        ) : null}
      </>
    );
  }
  const kind = first.leading?.kind;
  if (kind === 'avatar' || kind === 'pill') return <PickerChip option={first} />;
  return <PickerPlainValue option={first} size={size} />;
}
