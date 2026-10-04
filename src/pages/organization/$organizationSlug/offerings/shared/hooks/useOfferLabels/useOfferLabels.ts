import { useTranslation } from 'react-i18next';

import type { OfferKind } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { OfferRecord, OfferState } from '@/shared/api/clinic/offerings-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { OFFER_LABELS_KEYS, OFFER_LABELS_NS } from './offer-labels.constants.ts';

/** How the Offerings family words an offer. */
export interface OfferLabels {
  /** Its value: "20% off" · "₹500 off" · "at ₹3,999" · "+1 session" (H:5460). */
  value: (offer: Pick<OfferRecord, 'kind' | 'value'>) => string;
  /** Its kind: "% off" · "₹ off" · "Fixed price" · "Extra sessions" (`S:1349`). */
  kind: (kind: OfferKind) => string;
  /** Its derived state: "Running" · "Scheduled" · "Paused" · "Ended". */
  state: (state: OfferState) => string;
  /** One of its days, a civil date: "22 Sep 2026". */
  date: (day: string) => string;
}

/**
 * The words for an offer the Offerings family shares (KICKOFF §6.11): the
 * Offerings table's Offer pill tooltip, the Offers table's Type cell, the
 * Offering drawer's "Offers on this" and the Offer drawer's pills and summary.
 * Amounts are clinic money (`usePaiseFormat`), days civil dates in the
 * viewer's locale; kinds and states are the shared clinic vocabulary.
 */
export function useOfferLabels(): OfferLabels {
  const { t } = useTranslation(OFFER_LABELS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  const { formatDate } = useLocaleFormat();
  return {
    value: ({ kind, value }) => {
      switch (kind) {
        case 'percent':
          return t(OFFER_LABELS_KEYS.percentOff, { value });
        case 'amount':
          return t(OFFER_LABELS_KEYS.amountOff, { amount: formatPaise(value) });
        case 'fixed':
          return t(OFFER_LABELS_KEYS.fixedAt, { amount: formatPaise(value) });
        case 'extra':
          return t(OFFER_LABELS_KEYS.extraSessions, { count: value });
      }
    },
    kind: (kind) => tClinic(CLINIC_KEYS.offerings.offerKinds[kind]),
    state: (state) => tClinic(CLINIC_KEYS.offerings.offerStates[state]),
    date: (day) =>
      formatDate(
        localDateOf(day),
        { day: 'numeric', month: 'short', year: 'numeric' },
        { civilDay: true },
      ),
  };
}
