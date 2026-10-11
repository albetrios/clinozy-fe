import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { localDateOf } from '@/shared/api/app/app-time.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PRINT_LANGUAGE, PRINT_TEMPLATE_NS } from './print-template.constants.ts';

const NUMERIC_DAY: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

/** The sheets' copy, always in the print language (Q-X2) — never the screen's. */
export function usePrintTranslation() {
  return useTranslation(PRINT_TEMPLATE_NS, { lng: PRINT_LANGUAGE });
}

/**
 * The sheets' number and date formats, through the viewer's regional format
 * (`useLocaleFormat`). Always standard notation: a compact number preference
 * never turns ₹1,200.00 into "1.2K" on a bill. Money is in `currency` (the
 * organization's); a sheet without money leaves it out.
 */
export function usePrintFormat(currency?: string) {
  const { formatCurrency, formatDate, formatNumber } = useLocaleFormat();
  return useMemo(
    () => ({
      /** Paise as money: "₹1,416.00". */
      money: (paise: number) => formatCurrency(Math.round(paise), currency),
      /** Paise as a plain amount, no symbol: "120.00". */
      amount: (paise: number) =>
        formatNumber(Math.round(paise) / 100, {
          notation: 'standard',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      /** A whole percentage: "18.00%". */
      percent: (value: number) =>
        formatNumber(value / 100, {
          notation: 'standard',
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      /** A count: "8". */
      count: (value: number) => formatNumber(value, { notation: 'standard' }),
      /** A calendar date, numeric: "24/09/2026" in English (India). */
      date: (civilDate: string) =>
        formatDate(localDateOf(civilDate), NUMERIC_DAY, { civilDay: true }),
    }),
    [currency, formatCurrency, formatDate, formatNumber],
  );
}
