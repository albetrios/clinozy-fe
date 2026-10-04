import { useTranslation } from 'react-i18next';

import type { AppointmentStatus } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { APPOINTMENT_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';

/** Props for {@link AppointmentStatusPill}. */
export interface AppointmentStatusPillProps {
  status: AppointmentStatus;
  /** 24px in the Agenda and the card (default), 22px where it sits smaller. */
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * A booking's status as the room draws it (H:2045): the status tone's pill
 * with a 6px dot in the tone's dot colour — Scheduled butter, Confirmed sky,
 * Checked in lav, Completed sage, Cancelled stone, No show blush (H:3420).
 */
export function AppointmentStatusPill({
  status,
  size = 'md',
  className,
}: AppointmentStatusPillProps) {
  const { t } = useTranslation(CLINIC_NS);
  return (
    <TonePill
      tone={APPOINTMENT_STATUS_TONES[status]}
      dot="tone"
      size={size}
      className={className}
    >
      {t(CLINIC_KEYS.appointments.statuses[status])}
    </TonePill>
  );
}
