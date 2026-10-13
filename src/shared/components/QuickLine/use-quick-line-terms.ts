import { useTranslation } from 'react-i18next';

import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { QUICK_LINE_KEYS, QUICK_LINE_NS } from './quick-line.constants.ts';
import type { QuickLineParse } from './quick-line.types.ts';
import {
  parseQuickLineTerms,
  type QuickLineTermOptions,
  type QuickLineTermValues,
} from './quick-line-terms.ts';

const K = QUICK_LINE_KEYS.tags;

/**
 * An item line's `parse` (H:3861–3863): the shared shorthand, read with the
 * line's own terms, and its pills in the shared words — "×20", "+2 free",
 * "@ ₹180", "10% off" — which the line shows while it has text.
 */
export function useQuickLineTerms(
  options: QuickLineTermOptions,
): (text: string) => QuickLineParse<QuickLineTermValues> {
  const { t } = useTranslation(QUICK_LINE_NS);
  const formatPaise = usePaiseFormat();
  return (text) => {
    const { words, values } = parseQuickLineTerms(text, options);
    const tags: string[] = [];
    if (values.qty) tags.push(t(K.qty, { count: values.qty }));
    if (values.free) tags.push(t(K.free, { count: values.free }));
    if (values.rate) tags.push(t(K.rate, { amount: formatPaise(values.rate) }));
    if (values.discountPct) tags.push(t(K.discount, { percent: values.discountPct }));
    return { words, tags, values };
  };
}
