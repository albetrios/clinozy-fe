import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';

import type { AppointmentView } from '@/shared/api/clinic/appointments-contracts.ts';
import {
  useViewportTier,
  type ViewportTier,
} from '@/shared/hooks/useViewportTier/index.ts';

import {
  APPOINTMENTS_SEARCH_DEFAULTS,
  validateAppointmentsSearch,
} from '../../appointments.search.ts';

/** The view a tier shows: Week is not offered on a phone, so it renders Day there (H:5941). */
function shownView(asked: AppointmentView, tier: ViewportTier): AppointmentView {
  return asked === 'week' && tier === 'phone' ? 'day' : asked;
}

/**
 * The view the page shows (D27): the URL's `view`, Agenda by default — but
 * Week is not offered on a phone, so below `md` a `view=week` link renders
 * Day and the URL is replaced to say so (H:5941). The drawer's route and the
 * Settings hash stay as they are.
 */
export function useAppointmentsView(): AppointmentView {
  const raw: Record<string, unknown> = useSearch({ strict: false });
  const asked = validateAppointmentsSearch(raw).view ?? APPOINTMENTS_SEARCH_DEFAULTS.view;
  const shown = shownView(asked, useViewportTier());
  const navigate = useNavigate();
  const replaceWeek = asked === 'week' && shown === 'day';

  useEffect(() => {
    if (!replaceWeek) return;
    void navigate({
      to: '.',
      search: (current) => ({ ...current, view: 'day' as const }),
      hash: true,
      replace: true,
    });
  }, [replaceWeek, navigate]);

  return shown;
}
