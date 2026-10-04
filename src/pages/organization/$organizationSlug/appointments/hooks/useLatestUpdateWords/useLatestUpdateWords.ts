import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicClockTime, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from '../../appointments.constants.ts';
import type { LatestUpdate } from '../../appointments.display.ts';

/** The pills' copy (`appointments.md:359–360`). */
const KEYS = APPOINTMENTS_KEYS.agenda;

/** A "Latest update" in words: the pill's label (its mark included) and its line. */
export interface LatestUpdateWords {
  /** "✓ Plan ready", "○ Plan pending", "✓ Moved ×2" (`appointments.md:359`). */
  label: (update: LatestUpdate) => string;
  /** "Reminder read on WhatsApp", "Moved from Sat 3 Oct 10:30 am" (`appointments.md:360`). */
  hint: (update: LatestUpdate) => string;
}

/**
 * The "Latest update" pills' words — the Agenda's pills and tooltips, and the
 * appointment card's last-update line. "Moved from" names the old slot
 * clinic-local, as the toasts do.
 */
export function useLatestUpdateWords(): LatestUpdateWords {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const slotLabel = useAppointmentSlotLabel();

  const label = useCallback(
    (update: LatestUpdate) => {
      if (update.kind === 'moved' && update.times > 1) {
        return t(KEYS.latest.movedTimes, { times: update.times });
      }
      return t(KEYS.latest[update.kind]);
    },
    [t],
  );

  const hint = useCallback(
    (update: LatestUpdate) => {
      if (update.kind === 'planReady') {
        return t(KEYS.latestHints.planReady, { suggestions: update.suggestions });
      }
      if (update.kind === 'moved') {
        // A move whose old slot is not on record says only that it moved.
        if (!update.from) return label(update);
        const instant = new Date(update.from);
        return t(
          KEYS.latestHints.moved,
          slotLabel(clinicToday(instant), clinicClockTime(instant)),
        );
      }
      return t(KEYS.latestHints[update.kind]);
    },
    [t, slotLabel, label],
  );

  return { label, hint };
}
