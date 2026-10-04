import { useTranslation } from 'react-i18next';

import { civilDayOffset, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { OfferRecord, OfferState } from '@/shared/api/clinic/offerings-contracts.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { OFFERS_KEYS, OFFERS_NS } from '../../offers.constants.ts';

const K = OFFERS_KEYS.cells;

/** How many offering names the Applies to cell spells out before "+N" (H:5480). */
const NAMED_OFFERINGS = 2;

/** How the Offers tab words a row's values — its cells and its meta line alike. */
export interface OfferText {
  /** "22 Sep 2026" — a civil date, day month year. */
  date: (date: string) => string;
  /**
   * "B1G1 D-Tan Facial, Back Peeling +1" — the offerings the catalogue still
   * holds (a deleted one is left out).
   */
  appliesTo: (
    offer: Pick<OfferRecord, 'offeringIds'>,
    nameOf: (id: string) => string | undefined,
  ) => string;
  /** "22 Sep 2026 – 2 Oct 2026"; a blank start reads "Now", a blank end "no end". */
  valid: (offer: Pick<OfferRecord, 'startsOn' | 'endsOn'>) => string;
  /**
   * The Valid cell's sub-line: "Ends today" · "Ends tomorrow" · "Ends in 28
   * days" while running · "Starts 1 Nov 2026" when scheduled · "Over" once
   * ended · none while paused (or running with no end).
   */
  validSub: (
    offer: Pick<OfferRecord, 'startsOn' | 'endsOn'>,
    state: OfferState,
    today: string,
  ) => string;
}

/** The Offers tab's words for a row (`offerings.md:47`; H:5479–5481). */
export function useOfferText(): OfferText {
  const { t } = useTranslation(OFFERS_NS);
  const { formatDate } = useLocaleFormat();
  const date = (day: string) =>
    formatDate(
      localDateOf(day),
      { day: 'numeric', month: 'short', year: 'numeric' },
      { civilDay: true },
    );
  return {
    date,
    appliesTo: ({ offeringIds }, nameOf) => {
      const names = offeringIds.flatMap((id) => nameOf(id) ?? []);
      const shown = names.slice(0, NAMED_OFFERINGS).join(', ');
      const more = names.length - NAMED_OFFERINGS;
      return more > 0 ? `${shown} ${t(K.more, { count: more })}` : shown;
    },
    valid: ({ startsOn, endsOn }) =>
      t(K.range, {
        start: startsOn ? date(startsOn) : t(K.now),
        end: endsOn ? date(endsOn) : t(K.noEnd),
      }),
    validSub: ({ startsOn, endsOn }, state, today) => {
      if (state === 'ended') return t(K.over);
      if (state === 'scheduled')
        return startsOn ? t(K.startsOn, { date: date(startsOn) }) : '';
      if (state !== 'live' || !endsOn) return '';
      const left = civilDayOffset(today, endsOn);
      if (left <= 0) return t(K.endsToday);
      if (left === 1) return t(K.endsTomorrow);
      return t(K.endsIn, { count: left });
    },
  };
}
