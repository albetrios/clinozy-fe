import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { AppIcon } from '@/shared/icons/index.ts';

import { PICKER_TONE_CLASSES } from './picker-tone.ts';

/** A tone dot: 10px with a 3px halo in a row, a plain 8px dot in the trigger. */
export function PickerDot({
  tone,
  variant = 'row',
}: {
  tone: Tone;
  variant?: 'row' | 'trigger';
}) {
  const classes = PICKER_TONE_CLASSES[tone];
  // Status dots (≤ 10px) stay round under every shape: an indicator, not a surface.
  const shape =
    variant === 'row' ? 'mx-0.75 size-2.5 rounded-full ring-3' : 'size-2 rounded-full';
  return (
    <span
      aria-hidden="true"
      className={cn('shrink-0', shape, classes.dot, variant === 'row' && classes.halo)}
    />
  );
}

/**
 * Initials on a disc in the tone (26px in a row, 22px in a trigger chip). For
 * a patient it carries the 12px green "P" badge; the badge's meaning is read
 * out by the row's own sr-only text, so the disc is decorative.
 */
export function PickerAvatar({
  initials,
  tone,
  patientMark,
  variant = 'row',
}: {
  initials: string;
  tone: Tone;
  /** The badge letter, when the person is a patient. */
  patientMark?: string;
  variant?: 'row' | 'chip';
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="pill"
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full font-semibold',
        PICKER_TONE_CLASSES[tone].soft,
        variant === 'row' ? 'size-6.5 text-[0.59375rem]' : 'size-5.5 text-[0.5625rem]',
      )}
    >
      {initials}
      {patientMark ? (
        <span
          data-slot="pill"
          className="border-background bg-success text-background absolute -end-0.5 -bottom-0.5 flex size-3 items-center justify-center rounded-full border-2 text-[0.4375rem] leading-none font-bold"
        >
          {patientMark}
        </span>
      ) : null}
    </span>
  );
}

/** A 24px tile in the tone with the option's 16px icon. */
export function PickerIconTile({ icon: Icon, tone }: { icon: AppIcon; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md',
        PICKER_TONE_CLASSES[tone].soft,
      )}
    >
      <Icon className="size-4 text-current" />
    </span>
  );
}

/** A label drawn as a 24px tone pill (12px/500 in a row, 12.5px in a trigger). */
export function PickerPill({
  tone,
  icon: Icon,
  variant = 'row',
  children,
}: {
  tone: Tone;
  icon?: AppIcon;
  variant?: 'row' | 'chip';
  children: ReactNode;
}) {
  return (
    <span
      data-slot="pill"
      className={cn(
        'inline-flex h-6 max-w-full min-w-0 shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 font-medium whitespace-nowrap',
        PICKER_TONE_CLASSES[tone].soft,
        variant === 'row' ? 'text-xs' : 'text-detail',
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-current" />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
