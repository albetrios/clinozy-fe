import { useTranslation } from 'react-i18next';

import type { AppointmentStatus } from '@/shared/api/app/app-schema.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { APPOINTMENT_STATUS_TONES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';

/** Props for {@link AppointmentStatusPill}. */
export interface AppointmentStatusPillProps {
  status: AppointmentStatus;
  /** 24px in the Agenda and the card (default), 22px where it sits smaller, 18px in a calendar block. */
  size?: 'md' | 'sm' | 'xs';
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
  const { t } = useTranslation(APP_NS);
  return (
    <TonePill
      tone={APPOINTMENT_STATUS_TONES[status]}
      dot="tone"
      size={size}
      className={className}
    >
      {t(APP_KEYS.appointments.statuses[status])}
    </TonePill>
  );
}
