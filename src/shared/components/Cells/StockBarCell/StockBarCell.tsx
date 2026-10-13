import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';

/** Props of {@link StockBarCell}: the line, how full the bar is and its tone. */
export interface StockBarCellProps {
  /** "8 in stock · OK", "3 tube · 90 g · Low". */
  label: string;
  /** The bar's fill, a whole percent 0–100. */
  percent: number;
  /** The stock level's tone: sage OK, butter low, blush out. */
  tone: Tone;
  className?: string;
}

/**
 * The stock cell of Medical › Medicines and Clinic stock › Items
 * (`medical.md:45`, `clinic-stock.md:29`): the stock line at 12.5px over a
 * 5px bar filled to `percent` in the level's ink. The bar is decorative —
 * the line says the level.
 */
export function StockBarCell({ label, percent, tone, className }: StockBarCellProps) {
  return (
    <span className={cn('flex w-full max-w-36 min-w-0 flex-col gap-1.5', className)}>
      <span className="text-detail truncate leading-none tabular-nums">{label}</span>
      <span
        aria-hidden="true"
        data-slot="pill"
        className="bg-muted h-1.25 w-full overflow-hidden rounded-full"
      >
        <span
          data-slot="pill"
          data-testid="stock-bar-fill"
          className={cn('block h-full w-(--fill) rounded-full', TONE_CLASSES[tone].fill)}
          style={{ '--fill': `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties}
        />
      </span>
    </span>
  );
}
