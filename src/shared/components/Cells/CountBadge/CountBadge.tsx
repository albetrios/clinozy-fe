import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';

/** A count badge's fill: the primary (default), success green, or the inverse ink. */
export type CountBadgeTone = 'primary' | 'success' | 'inverse';

/** Literal fills per tone, so Tailwind sees every class. */
const COUNT_BADGE_TONES: Readonly<Record<CountBadgeTone, string>> = {
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success text-success-foreground',
  inverse: 'bg-foreground text-background',
};

/** Props of {@link CountBadge}. */
export interface CountBadgeProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** The number it shows. */
  count: number;
  /** Above this it reads "<max>+" (default 99). */
  max?: number;
  tone?: CountBadgeTone;
  /** What it says instead of the bare number ("2 new"). */
  children?: ReactNode;
  /**
   * The screen reader's words for it ("3 unread"): the shown figure is then
   * hidden from assistive tech. Without it the badge reads its own text.
   */
  srLabel?: string;
}

/**
 * The 18px count pill (KICKOFF §3.1; H:1089, H:4797): 10.5px/600 tabular
 * figures, at least as wide as it is tall, `rounded-full` with
 * `data-slot="pill"` so the Sharp shape squares it — the Filters button's
 * applied count, the patient file's unread activity, a clinical card's "2
 * new", the account menu's unread notifications. Callers place it (a corner
 * badge passes its own `absolute` classes).
 */
export function CountBadge({
  count,
  max = 99,
  tone = 'primary',
  children,
  srLabel,
  className,
  ...props
}: CountBadgeProps) {
  const shown = children ?? (count > max ? `${max}+` : count);
  return (
    <span
      data-slot="pill"
      className={cn(
        'text-tiny inline-flex h-4.5 min-w-4.5 flex-none items-center justify-center rounded-full px-1.25 font-semibold whitespace-nowrap tabular-nums',
        COUNT_BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {srLabel ? (
        <>
          <span aria-hidden="true">{shown}</span>
          <span className="sr-only">{srLabel}</span>
        </>
      ) : (
        shown
      )}
    </span>
  );
}
