import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The Mode · Amount rows live in `clinic`: Receive payment and the give-back
 * drawer carry them, and the give-back drawer opens from the patient file too
 * (KICKOFF §6.9).
 */
export const SPLIT_ROWS_NS = I18N_NAMESPACES.clinic;

/** Key paths for the rows' headers (`payments.md:103, 174`; verbatim). */
export const SPLIT_ROWS_KEYS = {
  /** "Mode" — the first column, and an empty row's placeholder. */
  mode: 'splitRows.mode',
  /** "Amount". */
  amount: 'splitRows.amount',
} as const;
