import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';

/** Props of {@link TextCell}. */
export interface TextCellProps {
  /** The 13px line. */
  text: ReactNode;
  /** The 12px line under it, muted unless toned. */
  sub?: ReactNode;
  /** The sub line's ink ("Needs MRP and composition" butter, "− ₹239 returned" lav). */
  subTone?: Tone;
  /** 500 for names (a medicine, a supplier), 600 for money totals. */
  weight?: 'normal' | 'medium' | 'semibold';
  /** End-aligned (amount) cells. */
  align?: 'start' | 'end';
  className?: string;
}

const WEIGHT = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
} as const;

/**
 * A two-line table cell (H:684): a 13px line over a 12px muted one, both
 * truncating — a medicine and its composition, a bill and what came back, a clinic item
 * and its pack size. Each line takes its own direction from its text
 * (`dir="auto"`): a supplier's phone keeps its order on a right-to-left page.
 */
export function TextCell({
  text,
  sub,
  subTone,
  weight = 'normal',
  align = 'start',
  className,
}: TextCellProps) {
  return (
    <span
      className={cn(
        'flex max-w-full min-w-0 flex-col leading-[1.3]',
        align === 'end' && 'items-end text-end',
        className,
      )}
    >
      {/* Each line isolated in its own direction, aligned as the cell is. */}
      <span
        dir="auto"
        className={cn('max-w-full truncate [text-align:match-parent]', WEIGHT[weight])}
      >
        {text}
      </span>
      {sub ? (
        <span
          dir="auto"
          className={cn(
            'max-w-full truncate [text-align:match-parent] text-xs',
            subTone ? TONE_CLASSES[subTone].ink : 'text-muted-foreground',
          )}
        >
          {sub}
        </span>
      ) : null}
    </span>
  );
}
