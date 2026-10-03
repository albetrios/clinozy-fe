import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';

/** A pill's paint: a tone, `neutral` (`bg-muted`) or `inverse` (the dark ink pill). */
export type PillTone = Tone | 'neutral' | 'inverse';

/** The two surfaces that are not tones — every tone comes from `TONE_CLASSES`. */
const PLAIN_SURFACES = {
  neutral: 'bg-muted text-muted-foreground-strong',
  inverse: 'bg-primary text-primary-foreground',
} as const;

/**
 * 24px status pills in tables (12px/500, H:688) and 22px pills in person cards
 * (kind, tags, consent; 11.5px/500, H:2732).
 */
const PILL_SIZES = {
  sm: 'h-5.5 gap-1 px-2 text-caption',
  md: 'h-6 gap-1.5 px-2.5 text-xs',
} as const;

/** Props for {@link TonePill}: the tone, the size, and an optional dot or icon. */
export interface TonePillProps extends ComponentProps<'span'> {
  tone: PillTone;
  size?: keyof typeof PILL_SIZES;
  /** A 6px dot in the pill's ink before the label (statuses). */
  dot?: boolean;
  /** A leading icon (12px). */
  icon?: ReactNode;
}

/** A label on a tinted pill — status, kind, tag or consent — in a section tone. */
export function TonePill({
  tone,
  size = 'md',
  dot = false,
  icon,
  className,
  children,
  ...props
}: TonePillProps) {
  const surface =
    tone === 'neutral' || tone === 'inverse'
      ? PLAIN_SURFACES[tone]
      : TONE_CLASSES[tone].surface;
  return (
    <span
      data-slot="pill"
      data-tone={tone}
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-full font-medium whitespace-nowrap',
        PILL_SIZES[size],
        // After the size: a text size resets the line height (H:688, line-height 1).
        'leading-none',
        surface,
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0 [&_svg]:size-3">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
