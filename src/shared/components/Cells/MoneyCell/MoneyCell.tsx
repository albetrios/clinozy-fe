import type { ComponentProps } from 'react';

import { paiseOfRupees } from '@/lib/number-text.ts';
import { cn } from '@/lib/utils.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

/** The amount a {@link MoneyCell} shows: clinozy-be's rupees, or a fixture room's paise. */
type MoneyCellAmount =
  | {
      /** Rupees as clinozy-be sends them (two places) — the rooms on the API (D148 Q10). */
      rupees: number;
      paise?: never;
    }
  | {
      /** Integer paise — the rooms still on fixtures, until they move (S:4). */
      paise: number;
      rupees?: never;
    };

/** Props for {@link MoneyCell}: an amount, optionally signed. */
export type MoneyCellProps = Omit<ComponentProps<'span'>, 'children'> &
  MoneyCellAmount & {
    /** Prefix a positive amount with "+" (ledgers that show the direction). */
    signed?: boolean;
  };

/**
 * The money cell: ₹ in the user's format locale (Indian grouping on `en-IN`),
 * "−" (U+2212) before a negative, tabular figures, never wrapping
 * (KICKOFF §3.5 Cells; `inrF`, H:3563). Alignment and colour are the column's.
 */
export function MoneyCell({
  paise,
  rupees,
  signed = false,
  className,
  ...props
}: MoneyCellProps) {
  const formatPaise = usePaiseFormat();
  const minor = rupees === undefined ? paise : paiseOfRupees(rupees);
  const amount = formatPaise(minor);
  return (
    <span
      data-slot="money"
      className={cn('whitespace-nowrap tabular-nums', className)}
      {...props}
    >
      {signed && minor > 0 ? `+${amount}` : amount}
    </span>
  );
}
