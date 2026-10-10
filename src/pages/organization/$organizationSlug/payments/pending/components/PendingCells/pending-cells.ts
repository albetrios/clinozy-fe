import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicDateOf } from '@/shared/api/clinic/clinic-filter-match.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';

/*
 * What Pending's cells say about a credit (`payments.md:45`) — the wording the
 * cells, the meta line and the phone rows share.
 */

const K = PAYMENTS_KEYS.pending;

/** A credit is open while something of it is left to settle. */
export const isOpenCredit = (credit: Pick<CreditRow, 'status'>) =>
  credit.status === 'open';

/**
 * Whether a credit can still change or be deleted: open, and nothing of it settled yet (the
 * API refuses a change or a delete after the first settlement, `409 credit_settled`).
 */
export const isChangeableCredit = (credit: Pick<CreditRow, 'status' | 'settled'>) =>
  isOpenCredit(credit) && credit.settled <= 0;

/**
 * Why a credit no longer changes, as a row's click and its edit link say it — settled in full
 * ("CR-1 · Received") or in part ("CR-1 · ₹50 settled · it can’t change now") — or null while
 * nothing of it is settled.
 */
export function useCreditLockLabel(): (
  credit: Pick<CreditRow, 'seq' | 'status' | 'settled'>,
) => string | null {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  return (credit) => {
    const ref = displayId.pendingCredit(credit.seq);
    if (!isOpenCredit(credit)) return `${ref} · ${t(K.states[credit.status])}`;
    if (credit.settled > 0) {
      return t(K.settledLocked, { ref, amount: formatRupees(credit.settled) });
    }
    return null;
  };
}

/** The Why cell's reason: the chip's label, or the stored text ("Other"'s note, or the API's). */
export function creditReason(
  credit: Pick<CreditRow, 'reasonKey' | 'reason'>,
  t: TFunction,
): string {
  if (credit.reasonKey !== 'other') return t(K.reasons[credit.reasonKey]);
  return credit.reason;
}

/**
 * The Why cell's sub line (`payments.md:45`): where it came from — a ledger entry, else the
 * invoice it is for — else "By hand". The API serves the links' ids, not their numbers
 * (PAY-G2), so the line names the kind of link.
 */
export function creditSource(
  credit: Pick<CreditRow, 'sourcePaymentId' | 'invoiceId'>,
  t: TFunction,
): string {
  if (credit.sourcePaymentId !== null) return t(K.fromEntry);
  if (credit.invoiceId !== null) return t(K.forInvoice);
  return t(K.byHand);
}

/**
 * The State pill's label: "Open", "Returned", "Received", "Adjusted" — and
 * " · Today" for one settled today ("Returned · Today").
 */
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
