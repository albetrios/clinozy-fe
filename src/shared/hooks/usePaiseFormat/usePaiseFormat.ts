import { useCallback } from 'react';

import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/** The clinic is single-currency: every amount in the contract is INR paise (S:4). */
export const CLINIC_CURRENCY = 'INR';

/** U+2212, the design's minus for negative money (KICKOFF §3.5). */
const MINUS_SIGN = '−';

/** A whole-rupee amount prints without paise, as the design's `inrF` (H:3563). */
const WHOLE_RUPEES: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

/**
 * Formats clinic money: integer paise → rupees in the user's format locale
 * (`en-IN` gives the Indian grouping, ₹1,23,456), paise shown only when there
 * are some, and "−" (U+2212) before a negative amount. Through
 * `useLocaleFormat`, so the Appearance currency display applies.
 */
export function usePaiseFormat(): (paise: number) => string {
  const { formatCurrency } = useLocaleFormat();
  return useCallback(
    (paise: number) => {
      if (!Number.isFinite(paise)) return '—';
      const magnitude = Math.abs(paise);
      const text = formatCurrency(
        magnitude,
        CLINIC_CURRENCY,
        magnitude % 100 === 0 ? WHOLE_RUPEES : undefined,
      );
      return paise < 0 ? `${MINUS_SIGN}${text}` : text;
    },
    [formatCurrency],
  );
}
