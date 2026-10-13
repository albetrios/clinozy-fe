import { useCallback } from 'react';

import { paiseOfRupees } from '@/lib/number-text.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

/**
 * Formats clinic money as clinozy-be sends it — rupees, a JSON number with two places (D148
 * Q10) — exactly as {@link usePaiseFormat} prints paise: the user's format locale (Indian
 * grouping on `en-IN`), paise only when there are some, "−" (U+2212) before a negative, "—"
 * for a value that is not a number.
 *
 * @remarks The rooms on clinozy-be read money with this; the rooms still on fixtures keep
 * paise ({@link usePaiseFormat}) until they move, and the paise one goes with the last of them.
 */
export function useRupeeFormat(): (rupees: number) => string {
  const formatPaise = usePaiseFormat();
  return useCallback(
    (rupees: number) =>
      formatPaise(Number.isFinite(rupees) ? paiseOfRupees(rupees) : Number.NaN),
    [formatPaise],
  );
}
