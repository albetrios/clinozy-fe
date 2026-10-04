import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { MedicineMaker } from '@/shared/api/clinic/medicines-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';

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
 * truncating — a medicine and its composition, a bill and what came back.
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
      <span className={cn('max-w-full truncate', WEIGHT[weight])}>{text}</span>
      {sub ? (
        <span
          className={cn(
            'max-w-full truncate text-xs',
            subTone ? TONE_CLASSES[subTone].ink : 'text-muted-foreground',
          )}
        >
          {sub}
        </span>
      ) : null}
    </span>
  );
}

/** The manufacturers as pills in their own tones (`medical.md:45, 77`). */
export function MakerPills({ makers }: { makers: readonly MedicineMaker[] }) {
  if (makers.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {makers.map((maker) => (
        <TonePill key={maker.id} tone={maker.tone}>
          {maker.name}
        </TonePill>
      ))}
    </span>
  );
}

/** Names as grey pills (a manufacturer's suppliers) or in one tone (its MRs, mint). */
export function NamePills({
  names,
  tone = 'neutral',
}: {
  names: readonly { id: string; name: string }[];
  tone?: Tone | 'neutral';
}) {
  if (names.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {names.map((entry) => (
        <TonePill key={entry.id} tone={tone}>
          {entry.name}
        </TonePill>
      ))}
    </span>
  );
}
