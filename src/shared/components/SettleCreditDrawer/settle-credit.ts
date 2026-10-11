import { paiseOfRupees, rupeesOfPaise } from '@/lib/number-text.ts';
import type { CreditRow, CreditSettlement } from '@/shared/api/app/credits-contracts.ts';
import { paidAtOn } from '@/shared/api/app/payments-contracts.ts';
import {
  FIRST_SPLIT_MODE,
  paidSplits,
  type SplitRow,
  splitsTotal,
} from '@/shared/forms/SplitRowsField/index.ts';

/*
 * Give back / Got it back's form (`payments.md:170–180`; H:4035–4039) — pure,
 * so the drawer, its save label and its checks read one set of rules. The Mode ·
 * Amount rows hold paise (the shared `SplitRowsField`); what the API sends and
 * answers is rupees, converted here at the form's edge.
 */

/**
 * The drawer's form: where and when the money moves — the branch it is paid at and the clinic
 * day — and the Mode · Amount rows it moves in (paise).
 */
export interface SettleFormValues {
  branchId: string | null;
  /** `YYYY-MM-DD`; today by default. */
  paidOn: string;
  splits: SplitRow[];
}

/** What is still owed on a credit — the server's `left_amount` — as the rows hold money: paise. */
export const owedInPaise = (credit: Pick<CreditRow, 'left'>) =>
  paiseOfRupees(credit.left);

/**
 * The drawer opens on everything owed, in UPI (H:4428: `pays: [{ mode: 'UPI', amt }]`), today,
 * at the branch a new record files under.
 */
export function settleStart({
  owed,
  branchId,
  today,
}: {
  /** Paise. */
  owed: number;
  branchId: string | null;
  today: string;
}): SettleFormValues {
  return { branchId, paidOn: today, splits: [{ mode: FIRST_SPLIT_MODE, amount: owed }] };
}

/** What stops a save: no amount, or more than is owed (`payments.md:174`). */
export type SettleProblem = 'amount' | 'moreThanOwed';

/** The checks in the design's order (H:4038): an amount, then at most what is owed (paise). */
export function settleProblem(
  values: Pick<SettleFormValues, 'splits'>,
  owed: number,
): SettleProblem | null {
  const total = splitsTotal(values.splits);
  if (total <= 0) return 'amount';
  if (total > owed) return 'moreThanOwed';
  return null;
}

/**
 * What the drawer sends (`POST …/settle`, `method: money`): the money given back or got back, at
 * the branch picked — `fallbackBranch` when the clinic has one and shows no field — in the rows'
 * modes, in rupees, on the day picked (no `paid_at` for today: the server stamps now).
 */
export function settlementOf({
  values,
  direction,
  fallbackBranch,
  now = new Date(),
}: {
  values: SettleFormValues;
  direction: CreditRow['direction'];
  fallbackBranch: string;
  now?: Date;
}): CreditSettlement {
  const paidAt = paidAtOn(values.paidOn, now);
  return {
    action: direction === 'give' ? 'give_back' : 'got_back',
    branchId: values.branchId ?? fallbackBranch,
    splits: paidSplits(values.splits).map(({ mode, amount }) => ({
      mode,
      amount: rupeesOfPaise(amount),
    })),
    ...(paidAt ? { paidAt } : {}),
  };
}
