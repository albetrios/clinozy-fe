import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import type { PatientFileActivity } from '../../patient-id.search.ts';

/** The Activity column's state, and its button. */
export interface PatientFileActivityState {
  open: boolean;
  toggle: () => void;
}

/**
 * Whether the Activity column is open (KICKOFF §6.6 Activity default; D19):
 * a link's `activity` decides — the Patients row and ⌘K send `open` from `md`
 * and `closed` below — and becomes the session's state (`useUIStore`, never
 * persisted), so every other link, which leaves it out, finds the column as
 * it was last left; with no state yet, open from `md`, closed on a phone. The
 * Activity button flips the session's state and drops the link's word.
 */
export function usePatientFileActivity(
  activity: PatientFileActivity | undefined,
): PatientFileActivityState {
  const stored = useUIStore((state) => state.fileActivityOpen);
  const setStored = useUIStore((state) => state.setFileActivityOpen);
  const phone = useViewportTier() === 'phone';
  const navigate = useNavigate();

  useEffect(() => {
    if (activity) setStored(activity === 'open');
  }, [activity, setStored]);

  const open = activity ? activity === 'open' : (stored ?? !phone);
  return {
    open,
    toggle: () => {
      setStored(!open);
      if (!activity) return;
      void navigate({
        to: '.',
        search: (current: Record<string, unknown>) => ({
          ...current,
          activity: undefined,
        }),
        hash: true,
        replace: true,
      });
    },
  };
}
