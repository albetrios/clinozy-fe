import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

/** Props for {@link MoneyCell}: an amount in paise, optionally signed. */
export interface MoneyCellProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** The amount in integer paise, as the contract carries money (S:4). */
  paise: number;
  /** Prefix a positive amount with "+" (ledgers that show the direction). */
  signed?: boolean;
}

/**
 * The money cell: ₹ in the user's format locale (Indian grouping on `en-IN`),
 * "−" (U+2212) before a negative, tabular figures, never wrapping
 * (KICKOFF §3.5 Cells; `inrF`, H:3563). Alignment and colour are the column's.
 */
export function MoneyCell({
  paise,
  signed = false,
  className,
  ...props
}: MoneyCellProps) {
  const formatPaise = usePaiseFormat();
  const amount = formatPaise(paise);
  return (
    <span
      data-slot="money"
      className={cn('whitespace-nowrap tabular-nums', className)}
      {...props}
    >
      {signed && paise > 0 ? `+${amount}` : amount}
    </span>
  );
}
