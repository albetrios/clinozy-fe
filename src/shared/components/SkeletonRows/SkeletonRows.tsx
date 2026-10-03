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

/** Props for {@link SkeletonBar}: its shape and the row it is in. */
export interface SkeletonBarProps {
  shape?: keyof typeof SHAPES | 'avatar';
  /** The row this bar is in — picks its width from the 64 / 48 / 60% cycle (text bars only). */
  index?: number;
  className?: string;
}

/**
 * One flat skeleton bar: `bg-muted-strong`, no shimmer — the design's
 * shimmer animates a flat fill and never moves, so none is built (§3.1).
 * Decorative; the surrounding `SkeletonRows` (or the host) announces loading.
 */
export function SkeletonBar({ shape = 'text', index = 0, className }: SkeletonBarProps) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn(
        'bg-muted-strong animate-none',
        shape === 'avatar' ? 'size-8 shrink-0 rounded-full' : SHAPES[shape],
        shape === 'text' ? BAR_WIDTHS[index % BAR_WIDTHS.length] : null,
        className,
      )}
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
  className?: string;
  /** Each row's own box (height, padding) — the host's row metrics. */
  rowClassName?: string;
}

/**
 * Content replaced in place by flat bars while it loads (KICKOFF §6.0 States):
 * rows of 0.72em bars at the cycling widths, an optional round avatar each,
 * clicks off. One polite announcement says what is loading.
 */
export function SkeletonRows({
  rows = BAR_WIDTHS.length,
  avatar = false,
  label,
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
            {avatar ? <SkeletonBar shape="avatar" /> : null}
            <SkeletonBar index={row.index} />
          </div>
        ),
      )}
    </div>
  );
}
