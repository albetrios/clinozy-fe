import { useTranslation } from 'react-i18next';

import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';

import { TODAY_KEYS, TODAY_NS } from '../../today.constants.ts';
import type { TodayCard } from '../../today.lanes.ts';

/**
 * A card's second line (`today.md:54`), from the record: a booking's service
 * and where — its room, else its clinician ("Hydrafacial · Room 2",
 * "Consultation · Dr. Nisha"); the pharmacy's "3 medicines prescribed"; an
 * enquiry's interest and their latest words ("Clinical — Is Saturday
 * possible?"). Null when the record says nothing.
 */
export function useCardServiceLine(): (card: TodayCard) => string | null {
  const { t } = useTranslation(TODAY_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const K = TODAY_KEYS.card;
  return (card) => {
    if (card.kind === 'enquiry') {
      const interest = card.enquiry.interests.find((value) => value !== 'others');
      const label = interest ? tClinic(CLINIC_KEYS.leads.interests[interest]) : null;
      const message = card.enquiry.message?.trim() || null;
      if (label && message) return t(K.enquiry, { interest: label, message });
      return label ?? message;
    }
    const { row } = card;
    if (card.lane === 'pharmacy' && row.prescription) {
      return t(K.medicines, { count: row.prescription.items });
    }
    let where: string | null = null;
    if (row.room && row.room !== 'any') where = t(K.rooms[row.room]);
    else if (row.doctor) where = shortPersonName(personFullName(row.doctor));
    return where ? t(K.service, { service: row.serviceLabel, where }) : row.serviceLabel;
  };
}
