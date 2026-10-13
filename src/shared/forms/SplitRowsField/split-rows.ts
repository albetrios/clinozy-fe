import type { PaymentMode } from '@/shared/api/app/app-schema.ts';

/*
 * The Mode · Amount rows of money that changes hands (H:5071): a receipt's, a
 * give-back's, a get-back's — what a row holds and the rules every use of the
 * rows reads.
 */

/** The modes the rows offer (`PY_MODES`): Cash, UPI, Card — "Credit" is only ever a credit's. */
export const SPLIT_MODES = ['cash', 'upi', 'card'] as const;

/** One of the rows' modes. */
export type SplitMode = (typeof SPLIT_MODES)[number];

/** One Mode · Amount row: the mode, and the amount in paise (0 while empty). */
export interface SplitRow {
  mode: SplitMode | null;
  amount: number;
}

/** A new row starts in UPI (H:5070). */
export const FIRST_SPLIT_MODE: SplitMode = 'upi';

/** Whether a stored payment mode is one the rows offer. */
export const isSplitMode = (mode: PaymentMode): mode is SplitMode =>
  (SPLIT_MODES as readonly string[]).includes(mode);

/** Σ of the rows, in paise. */
export function splitsTotal(splits: readonly SplitRow[]): number {
  return splits.reduce((sum, row) => sum + row.amount, 0);
}

/**
 * The modes the money moves in, each once — the rows with an amount, else the
 * first row's (a fresh form reads "UPI").
 */
export function splitsModes(splits: readonly SplitRow[]): SplitMode[] {
  const paid = splits.filter((row) => row.amount > 0).map((row) => row.mode);
  const modes = paid.length > 0 ? paid : splits.slice(0, 1).map((row) => row.mode);
  return [...new Set(modes.filter((mode): mode is SplitMode => mode !== null))];
}

/** The mode an added row takes — the first one not used yet; none once all three are. */
export function nextSplitMode(splits: readonly SplitRow[]): SplitMode | null {
  return SPLIT_MODES.find((mode) => !splits.some((row) => row.mode === mode)) ?? null;
}

/** The rows the server takes: a mode and an amount above zero. */
export function paidSplits(
  splits: readonly SplitRow[],
): { mode: SplitMode; amount: number }[] {
  return splits.flatMap((row) =>
    row.mode && row.amount > 0 ? [{ mode: row.mode, amount: row.amount }] : [],
  );
}
