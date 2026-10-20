import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import type { PickerSize } from '@/shared/components/Picker/picker.types.ts';
import { revealItem } from '@/shared/components/Picker/picker-dom.ts';
import { PickerSheet } from '@/shared/components/Picker/PickerSheet/index.ts';
import { PickerTrigger } from '@/shared/components/Picker/PickerTrigger/index.ts';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group.tsx';
import { Clock } from '@/shared/icons/index.ts';

import { timeSlots } from './time-slots.ts';

/** Props for {@link TimePicker}. */
export interface TimePickerProps {
  /** The picked clock time, `HH:mm` (clinic-local). */
  value: string | null;
  onChange: (time: string) => void;
  /** The field's name (default "Time"). */
  label?: string;
  /** Trigger text with no time (default "Pick a time"). */
  placeholder?: string;
  /** First tile (default 06:00). */
  from?: string;
  /** Last tile (default 23:30). */
  to?: string;
  /** Minutes between tiles (default 30). */
  step?: number;
  size?: PickerSize;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-describedby'?: string;
  align?: 'start' | 'end';
  /** Base test id (default `time-picker`); tiles are `<id>-option-<HH:mm>`. */
  testId?: string;
  className?: string;
}

/**
 * The time dropdown (H:901, `users.md:114`): a 36px trigger with a clock glyph
 * and the time (or "Pick a time"), opening a grid of 60px tiles — 06:00 to
 * 23:30 every 30 minutes — at least 220px wide and 220px tall (the picker
 * sheet on a phone). Tiles are a single-select `toggle-group`: arrow keys move
 * between them and picking one closes the grid. Times are the contract's
 * clinic-local `HH:mm`, shown as written.
 */
export function TimePicker({
  value,
  onChange,
  label,
  placeholder,
  from,
  to,
  step,
  size = 'md',
  disabled,
  invalid,
  id,
  'aria-describedby': describedBy,
  align,
  testId = 'time-picker',
  className,
}: TimePickerProps) {
  const { t } = useTranslation(PICKER_NS);
  const [open, setOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const slots = useMemo(() => timeSlots(from, to, step), [from, to, step]);
  const name = label ?? t(PICKER_KEYS.time.label);
  const shownPlaceholder = placeholder ?? t(PICKER_KEYS.time.placeholder);
  // The name holds the words the trigger shows: the time, or the placeholder (WCAG 2.5.3).
  const triggerLabel = t(PICKER_KEYS.triggerLabel, {
    label: name,
    value: value === null || value === '' ? shownPlaceholder : value,
  });

  const focusTile = () => {
    const grid = gridRef.current;
    const tile =
      grid?.querySelector<HTMLElement>('[data-state="on"]') ??
      grid?.querySelector<HTMLElement>('button');
    if (!tile) return;
    tile.focus({ preventScroll: true });
    revealItem(tile);
  };

  return (
    <div className={cn('relative min-w-0', className)}>
      <PickerSheet
        open={open}
        onOpenChange={(next) => setOpen(next && !disabled)}
        title={name}
        align={align}
        panelClassName="w-(--radix-popover-trigger-width) min-w-55 rounded-xl"
        onOpenAutoFocus={focusTile}
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
            icon={<Clock className="size-3.5" />}
          >
            {value ? (
              <span className="truncate tabular-nums">{value}</span>
            ) : (
              <span className="text-muted-foreground truncate">{shownPlaceholder}</span>
            )}
          </PickerTrigger>
        }
      >
        <div
          data-picker-scroll=""
          className="max-h-55 min-h-0 overflow-y-auto overscroll-contain p-2"
        >
          <ToggleGroup
            ref={gridRef}
            type="single"
            spacing={1}
            value={value ?? ''}
            aria-label={name}
            onValueChange={(next) => {
              if (next) onChange(next);
              setOpen(false);
            }}
            className="grid w-full grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-1"
          >
            {slots.map((slot) => (
              <ToggleGroupItem
                key={slot}
                value={slot}
                data-testid={`${testId}-option-${slot}`}
                className="bg-background hover:bg-muted hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-7 w-full min-w-0 rounded-md border px-0 text-xs font-normal tabular-nums"
              >
                {slot}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </PickerSheet>
    </div>
  );
}
