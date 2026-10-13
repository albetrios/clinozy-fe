import { useTranslation } from 'react-i18next';

import type { OfferingSpecialty } from '@/shared/api/app/app-schema.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';

import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';

/**
 * The Consultation's name for a specialty — "Consultation" with one specialty, "<Specialty>
 * consultation" with more (D18).
 */
export function useConsultationName(): (
  specialty: OfferingSpecialty,
  count: number,
) => string {
  const { t } = useTranslation(SETUP_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return (specialty, count) =>
    count > 1
      ? t(SETUP_KEYS.starter.consultationNamed, {
          specialty: tApp(APP_KEYS.offerings.specialties[specialty]),
        })
      : t('starter.names.consultation');
}
