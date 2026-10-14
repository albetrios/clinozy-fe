import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import { Skeleton } from '@/shared/components/ui/skeleton.tsx';

/**
 * Text bar widths, cycled per row: 64 / 48 / 60% (KICKOFF §3.5 Skeletons;
 * `_patterns.md:282`). The picker draws its own four title-and-sub rows
 * (`PickerPanel`, H:3964).
 */
const BAR_WIDTHS = ['w-[64%]', 'w-[48%]', 'w-[60%]'] as const;

/**
 * What a skeleton stands in for: a text run becomes a 0.72em `rounded-md` bar,
 * an input a 36px `rounded-lg` bar (H:359–363). An avatar stays a round 32px
 * disc — drawn beside the `<Skeleton>` below, whose slot the Sharp shape squares.
 */
const SHAPES = {
  text: 'h-[0.72em] rounded-md',
  field: 'h-9 w-full rounded-lg',
} as const;

/** The shimmer's stagger: rows sweep 0 / 90 / 180ms apart, cycled (`skeleton-sheen.css`). */
const SWEEP_STEPS = 3;

/** The sheen's stylesheet was asked for — once per page. */
let sheenRequested = false;

/**
 * Loads `skeleton-sheen.css` the first time a bar shimmers. A dynamic import, not a static
 * one: a stylesheet this chunk imported would be listed in the first-paint chunk's preload
 * map (every lazy route that can reach a skeleton), and that chunk has no room for it
 * (change-contact-quick-pick D28). Until it lands — a frame or two — the bar shows its flat
 * fill.
 */
function requestSheen() {
  if (sheenRequested) return;
  sheenRequested = true;
  // A failed load (offline) leaves the flat fill — nothing to report.
  import('./skeleton-sheen.css').catch(() => {});
}

/** Props for {@link SkeletonBar}: its shape, the row it is in and whether it shimmers. */
export interface SkeletonBarProps {
  shape?: keyof typeof SHAPES | 'avatar';
  /**
   * The row this bar is in — picks its width from the 64 / 48 / 60% cycle (text bars only)
   * and, with `shimmer`, when its sheen sets off.
   */
  index?: number;
  /**
   * A soft sheen sweeps along the bar in the reading direction (`skeleton-sheen.css`) — for
   * loads someone is waiting on, such as a search. Off: the flat fill.
   */
  shimmer?: boolean;
  className?: string;
}

/**
 * One skeleton bar on `bg-muted-strong`, the primitive's pulse off. Flat by
 * default — the launch design's shimmer animated a flat fill and never moved, so
 * none was built (§3.1); `shimmer` opts in to the sheen sweep
 * (change-contact-quick-pick D11, `skeleton-sheen.css` — loaded the first
 * time a bar shimmers, not on the first paint), which the platform's reduced-motion rule
 * stills. Decorative; the surrounding `SkeletonRows` (or the host) announces
 * loading.
 */
export function SkeletonBar({
  shape = 'text',
  index = 0,
  shimmer = false,
  className,
}: SkeletonBarProps) {
  useEffect(() => {
    if (shimmer) requestSheen();
  }, [shimmer]);
  return (
    <Skeleton
      aria-hidden="true"
      className={cn(
        'bg-muted-strong animate-none',
        shimmer && 'skeleton-sheen',
        shape === 'avatar' ? 'size-8 shrink-0 rounded-full' : SHAPES[shape],
        shape === 'text' ? BAR_WIDTHS[index % BAR_WIDTHS.length] : null,
        className,
      )}
      data-sweep={shimmer ? index % SWEEP_STEPS : undefined}
    />
  );
}

/** Props for {@link SkeletonRows}: rows, avatars and what is loading. */
export interface SkeletonRowsProps {
  /** How many rows. Defaults to one full width cycle (3). */
  rows?: number;
  /** A round avatar before each bar — person rows. */
  avatar?: boolean;
  /** What is loading ("Patients"), for screen readers. */
  label?: string;
  /** Each row's bars shimmer, staggered down the rows ({@link SkeletonBarProps.shimmer}). */
  shimmer?: boolean;
  className?: string;
  /** Each row's own box (height, padding) — the host's row metrics. */
  rowClassName?: string;
}

/**
 * Content replaced in place by bars while it loads (KICKOFF §6.0 States):
 * rows of 0.72em bars at the cycling widths, an optional round avatar each,
 * clicks off — flat, or with `shimmer` a staggered sheen. One polite
 * announcement says what is loading.
 */
export function SkeletonRows({
  rows = BAR_WIDTHS.length,
  avatar = false,
  label,
  shimmer = false,
  className,
  rowClassName,
}: SkeletonRowsProps) {
  const { t } = useTranslation(LOCALE_NS);
  return (
    <div
      data-testid="skeleton-rows"
      aria-busy="true"
      className={cn('text-body flex cursor-progress flex-col', className)}
    >
      <output aria-live="polite" className="sr-only">
        {label
          ? t(LOCALE_KEYS.loadingNamed, { name: label })
          : `${t(LOCALE_KEYS.loading)}…`}
      </output>
      {Array.from({ length: rows }, (_, index) => ({ id: `row-${index}`, index })).map(
        (row) => (
          <div
            // Placeholder rows never reorder: their position is their identity.
            key={row.id}
            aria-hidden="true"
            data-testid="skeleton-row"
            className={cn(
              'pointer-events-none flex h-[1.28em] items-center gap-2.5',
              rowClassName,
            )}
          >
            {avatar ? (
              <SkeletonBar shape="avatar" index={row.index} shimmer={shimmer} />
            ) : null}
            <SkeletonBar index={row.index} shimmer={shimmer} />
          </div>
        ),
      )}
    </div>
  );
}
