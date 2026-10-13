import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';

/**
 * A drawer's colour field (the design's `swatch` kind, H:1600): one 30px
 * circle per tone, 8px apart, filled with the tone and edged in its line; the
 * picked one carries "✓" in the tone's ink — or the screen's `mark`, the
 * person's initials on the user drawer (`users.md:109`) — and a 1.5px ring in
 * the tone's edge colour. A radio group — one colour is always picked; each swatch is named by its
 * colour ("Sage"), aloud and as its tooltip.
 */
export function DrawerSwatches({
  label,
  tones,
  value,
  onChange,
  disabled,
  mark,
  testId,
}: {
  /** The group's accessible name — the field's label. */
  label: string;
  /** The colours offered, in order. */
  tones: readonly Tone[];
  value: Tone;
  onChange: (tone: Tone) => void;
  disabled?: boolean;
  /** What the picked swatch shows instead of "✓" (initials); empty keeps "✓". */
  mark?: string;
  /** Base test id; each swatch is `<testId>-<tone>`. */
  testId?: string;
}) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="flex flex-wrap gap-2"
    >
      {tones.map((option) => {
        const picked = option === value;
        const tone = TONE_CLASSES[option];
        const name = t(RECORD_DRAWER_KEYS.colours[option]);
        const pickedMark = mark || '✓'; // NOSONAR(S6606): an empty mark keeps "✓" too
        return (
          <button // NOSONAR(S6819): styled-button radiogroup; a native radio input cannot hold this swatch
            key={option}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={name}
            title={name}
            disabled={disabled}
            data-slot="pill"
            data-testid={testId ? `${testId}-${option}` : undefined}
            onClick={() => onChange(option)}
            className={cn(
              'flex size-7.5 flex-none items-center justify-center rounded-full border text-xs font-bold transition-shadow disabled:pointer-events-none disabled:opacity-50',
              tone.bg,
              tone.border,
              tone.ink,
              // The tone's edge colour, never its ink (change-shell-polish-and-sign-in, D7).
              picked
                ? cn('shadow-(--elevation-control)', tone.ring, 'ring-[1.5px]')
                : tone.selectedHover,
            )}
          >
            {picked ? <span aria-hidden="true">{pickedMark}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Props of {@link DrawerToggle}. */
export interface DrawerToggleProps extends Omit<
  ComponentProps<typeof SwitchPrimitive.Root>,
  'checked' | 'onCheckedChange' | 'children'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** What the pill says while on ("Inclusive", "Active · bookable"). */
  onLabel: string;
  /** What the pill says while off ("Exclusive", "Inactive · hidden"). */
  offLabel: string;
}

/**
 * A drawer's toggle (the design's `toggle` kind, H:1601): a 24px pill —
 * a 34×20 track with a 16px knob, then the state's words — that is itself
 * the switch. The track is the ink while on and `border-strong` while off;
 * the knob slides 14px (mirrored under RTL). Long words wrap rather than clip
 * in a narrow field (§7.3).
 */
export function DrawerToggle({
  checked,
  onCheckedChange,
  onLabel,
  offLabel,
  className,
  ...props
}: DrawerToggleProps) {
  return (
    <SwitchPrimitive.Root
      {...props}
      checked={checked}
      onCheckedChange={onCheckedChange}
      data-slot="pill"
      className={cn(
        // `rounded-xl` is a full round on the 24px pill, and a rounded box once
        // the words wrap in a narrow field (an oval would squeeze them).
        // The keyboard ring is the focus personality's, through the slot.
        'bg-background text-foreground inline-flex min-h-6 max-w-full items-center gap-2 self-start rounded-xl border py-0.5 ps-1 pe-3 text-start text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'relative h-5 w-8.5 flex-none rounded-full transition-colors duration-150',
          checked ? 'bg-primary' : 'bg-border-strong',
        )}
      >
        <SwitchPrimitive.Thumb
          data-slot="pill"
          className="bg-background absolute start-0.5 top-0.5 block size-4 rounded-full shadow-(--elevation-control) transition-transform duration-150 data-[state=checked]:translate-x-3.5 rtl:data-[state=checked]:-translate-x-3.5"
        />
      </span>
      <span className="min-w-0">{checked ? onLabel : offLabel}</span>
    </SwitchPrimitive.Root>
  );
}

/**
 * A drawer's read-only value (the design's `info` kind, H:1596): a 38px
 * `canvas` box with a 1px edge, 13.5px tabular figures — "Billed today",
 * "Offers on this", the Offer drawer's previews. One line with an ellipsis;
 * `wrap` lets a long value (a report's notes) run onto more lines instead.
 */
export function DrawerInfo({
  children,
  wrap = false,
  className,
  testId,
}: {
  children: ReactNode;
  wrap?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'bg-canvas text-field text-muted-foreground-strong flex min-h-9.5 min-w-0 items-center rounded-lg border px-2.5 tabular-nums',
        wrap && 'py-2',
        className,
      )}
    >
      <span
        className={cn('min-w-0', wrap ? 'break-words whitespace-pre-line' : 'truncate')}
      >
        {children}
      </span>
    </div>
  );
}
