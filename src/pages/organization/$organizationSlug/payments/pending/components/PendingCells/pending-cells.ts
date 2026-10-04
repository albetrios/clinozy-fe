import type { TFunction } from 'i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicDateOf } from '@/shared/api/clinic/clinic-filter-match.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PAYMENTS_KEYS } from '../../../payments.constants.ts';

/*
 * What Pending's cells say about a credit (`payments.md:45`) — the wording the
 * cells, the meta line and the phone rows share.
 */

const K = PAYMENTS_KEYS.pending;

/** A credit is open while nothing has settled it in full. */
export const isOpenCredit = (credit: Pick<CreditRow, 'status'>) =>
  credit.status === 'open';

/** The Why cell's reason: the chip's label, or the stored text (a seed's, or "Other"'s note). */
export function creditReason(
  credit: Pick<CreditRow, 'reasonKey' | 'reason'>,
  t: TFunction,
): string {
  if (credit.reasonKey && credit.reasonKey !== 'other')
    return t(K.reasons[credit.reasonKey]);
  return credit.reason;
}

/**
 * The Why cell's sub line (`payments.md:45`): the entry it came from ("From
 * PAY-5466 · Received"), else its invoice ("Invoice #785"), else "By hand".
 */
export function creditSource(credit: CreditRow, t: TFunction): string {
  if (credit.source) {
    return t(K.source, {
      ref: displayId.payment(credit.source.seq),
      direction: t(PAYMENTS_KEYS.directions[credit.source.direction]),
    });
  }
  if (credit.invoiceSeq !== null) return t(K.invoice, { seq: credit.invoiceSeq });
  return t(K.byHand);
}

/** The State pill's label: "Open", "Returned", "Received", "Adjusted" — "· Today" once settled today. */
export function creditStateLabel(
  credit: Pick<CreditRow, 'status' | 'settledAt'>,
  t: TFunction,
): string {
  const label = t(K.states[credit.status]);
  if (credit.settledAt && clinicDateOf(credit.settledAt) === clinicToday()) {
    return t(K.settledToday, { state: label });
  }
  return label;
}

/** "4 Jun" — the day a credit was added. */
export function useCreditSince(): (credit: Pick<CreditRow, 'createdAt'>) => string {
  const { formatDate } = useLocaleFormat();
  return (credit) => formatDate(credit.createdAt, { day: 'numeric', month: 'short' });
}
