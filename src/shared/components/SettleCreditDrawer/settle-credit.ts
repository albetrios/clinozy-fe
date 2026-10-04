import type { PendingCreditRecord } from '@/shared/api/clinic/credits-contracts.ts';
import {
  FIRST_SPLIT_MODE,
  type SplitRow,
  splitsTotal,
} from '@/shared/forms/SplitRowsField/index.ts';

/*
 * Give back / Got it back's form (`payments.md:170–180`; H:4035–4039) — pure,
 * so the drawer, its save label and its checks read one set of rules.
 */

/** The credit a give-back or a get-back settles — any read of a credit carries these. */
export type SettleCreditTarget = Pick<
  PendingCreditRecord,
  'id' | 'seq' | 'direction' | 'partyName' | 'amount' | 'adjusted' | 'reason'
>;

/** The drawer's form: the Mode · Amount rows the money moves in. */
export interface SettleFormValues {
  splits: SplitRow[];
}

/** What is still owed on a credit: its amount less what has been settled of it. */
export const owedOn = (credit: Pick<SettleCreditTarget, 'amount' | 'adjusted'>) =>
  Math.max(0, credit.amount - credit.adjusted);

/** The drawer opens on everything owed, in UPI (H:4428: `pays: [{ mode: 'UPI', amt }]`). */
export function settleStart(owed: number): SettleFormValues {
  return { splits: [{ mode: FIRST_SPLIT_MODE, amount: owed }] };
}

/** What stops a save: no amount, or more than is owed (`payments.md:174`). */
export type SettleProblem = 'amount' | 'moreThanOwed';

/** The checks in the design's order (H:4038): an amount, then at most what is owed. */
export function settleProblem(
  values: SettleFormValues,
  owed: number,
): SettleProblem | null {
  const total = splitsTotal(values.splits);
  if (total <= 0) return 'amount';
  if (total > owed) return 'moreThanOwed';
  return null;
}
