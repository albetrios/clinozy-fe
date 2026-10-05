import { useTranslation } from 'react-i18next';

import type { VisitPaymentMode } from '@/shared/api/clinic/visits-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';

/** A payment mode's label — the clinic's own words ("UPI", "Cash", "Card"). */
export function useModeLabel(): (mode: VisitPaymentMode) => string {
  const { t } = useTranslation(CLINIC_NS);
  return (mode) => t(CLINIC_KEYS.paymentModes[mode]);
}
