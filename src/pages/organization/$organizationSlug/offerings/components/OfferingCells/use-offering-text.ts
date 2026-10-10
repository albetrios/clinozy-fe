import { useTranslation } from 'react-i18next';

import type { OfferingCategory } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import type { EffectivePrice } from '@/shared/api/clinic/offerings-pricing.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { OFFERINGS_KEYS, OFFERINGS_NS } from '../../offerings.constants.ts';

const K = OFFERINGS_KEYS.cells;

/** How the Offerings tab words a row's values — its cells and its meta line alike. */
export interface OfferingText {
  /** The Offering cell's sub-line: the description, else "Valid 60 days", else none. */
  sub: (offering: Pick<OfferingRecord, 'description' | 'validityDays'>) => string;
  category: (category: OfferingCategory) => string;
  /** The billed price, "₹1,200". */
  price: (priced: EffectivePrice<OfferRecord>) => string;
  /** "was ₹1,500 · 20% off" below the list price, else "list price". */
  priceSub: (priced: EffectivePrice<OfferRecord>) => string;
  /** "45 min", or "—" for none (a product's, `offeringDuration`). */
  duration: (minutes: number | null) => string;
  /** "6 sessions + 1 free" / "1 session". */
  sessions: (sessions: number, extraSessions: number) => string;
  /** "valid 180 days", or none without a validity. */
  validFor: (days: number) => string;
  status: (isActive: boolean) => string;
}

/**
 * The Offerings tab's words for a row (`offerings.md:31`; H:5463–5467). Money
 * is clinozy-be's rupees (`useRupeeFormat`), categories the clinic vocabulary.
 */
export function useOfferingText(): OfferingText {
  const { t } = useTranslation(OFFERINGS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatRupees = useRupeeFormat();
  return {
    sub: ({ description, validityDays }) => {
      if (description) return description;
      return validityDays > 0 ? t(K.validDays, { count: validityDays }) : '';
    },
    category: (category) => tClinic(CLINIC_KEYS.offerings.categories[category]),
    price: (priced) => formatRupees(priced.final),
    priceSub: (priced) =>
      priced.final < priced.list
        ? t(K.wasPrice, { price: formatRupees(priced.list), percent: priced.percentOff })
        : t(K.listPrice),
    duration: (minutes) => (minutes === null ? '—' : t(K.minutes, { minutes })),
    sessions: (sessions, extraSessions) => {
      const base = t(K.sessions, { count: Math.max(1, sessions) });
      return extraSessions > 0
        ? t(K.sessionsFree, { sessions: base, count: extraSessions })
        : base;
    },
    validFor: (days) => (days > 0 ? t(K.validFor, { count: days }) : ''),
    status: (isActive) => t(isActive ? K.active : K.inactive),
  };
}
