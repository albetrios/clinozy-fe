import { useTranslation } from 'react-i18next';

import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';

import { TODAY_KEYS, TODAY_NS } from '../../today.constants.ts';
import type { TodayCard } from '../../today.lanes.ts';

/**
 * A card's second line (`today.md:54`), from the record: a booking's service
 * and where — its room, else its doctor ("Hydrafacial · Room 2",
 * "Consultation · Dr. Nisha"); the pharmacy's "3 medicines prescribed"; an
 * enquiry's interest ("Clinical" — their words are not on the lead row,
 * api-integration §8 G1). Null when the record says nothing.
 */
export function useCardServiceLine(): (card: TodayCard) => string | null {
  const { t } = useTranslation(TODAY_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const K = TODAY_KEYS.card;
  return (card) => {
    if (card.kind === 'enquiry') {
      const interest = card.enquiry.interests.find((value) => value !== 'others');
      return interest ? tApp(APP_KEYS.leads.interests[interest]) : null;
    }
    const { row } = card;
    if (card.lane === 'pharmacy' && row.prescription) {
      return t(K.medicines, { count: row.prescription.items });
    }
    const where =
      row.roomName ?? (row.doctorName ? shortPersonName(row.doctorName) : null);
    return where ? t(K.service, { service: row.serviceLabel, where }) : row.serviceLabel;
  };
}
