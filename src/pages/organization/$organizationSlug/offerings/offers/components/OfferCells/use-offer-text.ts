import { useTranslation } from 'react-i18next';

import { civilDayOffset } from '@/shared/api/app/app-time.ts';
import type { OfferRecord } from '@/shared/api/app/offerings-contracts.ts';

import { useOfferLabels } from '../../../shared/hooks/useOfferLabels/index.ts';
import { OFFERS_KEYS, OFFERS_NS } from '../../offers.constants.ts';

const K = OFFERS_KEYS.cells;

/** How many offering names the Applies to cell spells out before "+N" (H:5480). */
const NAMED_OFFERINGS = 2;

/** How the Offers tab words a row's values — its cells and its meta line alike. */
export interface OfferText {
  /**
   * "B1G1 D-Tan Facial, Back Peeling +1" — the offerings the catalogue still
   * holds (a deleted one is left out); "No offerings" once none is left
   * (OFFERINGS-M4).
   */
  appliesTo: (
    offer: Pick<OfferRecord, 'offeringIds'>,
    nameOf: (id: string) => string | undefined,
  ) => string;
  /** "22 Sep 2026 – 2 Oct 2026"; a blank start reads "Now", a blank end "no end". */
  valid: (offer: Pick<OfferRecord, 'startsOn' | 'endsOn'>) => string;
  /**
   * The Valid cell's sub-line by the server's status: "Ends today" · "Ends
   * tomorrow" · "Ends in 28 days" while running · "Starts 1 Nov 2026" when
   * scheduled · "Over" once ended · none while paused (or running with no end).
   */
  validSub: (
    offer: Pick<OfferRecord, 'startsOn' | 'endsOn' | 'status'>,
    today: string,
  ) => string;
}

/** The Offers tab's words for a row (`offerings.md:47`; H:5479–5481). */
export function useOfferText(): OfferText {
  const { t } = useTranslation(OFFERS_NS);
  const { date } = useOfferLabels();
  return {
    appliesTo: ({ offeringIds }, nameOf) => {
      const names = offeringIds.flatMap((id) => nameOf(id) ?? []);
      if (names.length === 0) return t(K.noOfferings);
      const shown = names.slice(0, NAMED_OFFERINGS).join(', ');
      const more = names.length - NAMED_OFFERINGS;
      return more > 0 ? `${shown} ${t(K.more, { count: more })}` : shown;
    },
    valid: ({ startsOn, endsOn }) =>
      t(K.range, {
        start: startsOn ? date(startsOn) : t(K.now),
        end: endsOn ? date(endsOn) : t(K.noEnd),
      }),
    validSub: ({ startsOn, endsOn, status }, today) => {
      if (status === 'ended') return t(K.over);
      if (status === 'scheduled')
        return startsOn ? t(K.startsOn, { date: date(startsOn) }) : '';
      if (status !== 'live' || !endsOn) return '';
      const left = civilDayOffset(today, endsOn);
      if (left <= 0) return t(K.endsToday);
      if (left === 1) return t(K.endsTomorrow);
      return t(K.endsIn, { count: left });
    },
  };
}
