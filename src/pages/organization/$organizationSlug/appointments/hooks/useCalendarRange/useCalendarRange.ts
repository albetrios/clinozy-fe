import {
  type AppointmentCalendarView,
  appointmentViewRange,
} from '@/shared/api/clinic/appointment-views.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { useAppointmentRange } from '@/shared/hooks/useAppointments/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

import { appointmentRangeParamsOf } from '../../appointments.params.ts';
import { useAppointmentsNavigation } from '../useAppointmentsNavigation/index.ts';

/** What a calendar draws from its read. */
export interface CalendarRead {
  /** The days the view shows, `from` to `to`. */
  range: { from: string; to: string };
  /** The range's bookings in slot order — the last range's while a new one loads. */
  rows: AppointmentRow[];
  /** Nothing read yet: the board draws its grid without blocks. */
  pending: boolean;
  /** The rows are the last range's: the board shows them as the in-place skeleton. */
  refreshing: boolean;
}

/**
 * A calendar's bookings (`GET /app/appointments`, every page of the range):
 * the days the view shows around the URL's anchor, with the page's filters and
 * the header's branches — every doctor when the view counts each doctor
 * itself (the Day). A failed read keeps the last copy and toasts "Couldn’t
 * load this list" with Retry (§6.0), as the Agenda does.
 */
export function useCalendarRange(
  view: AppointmentCalendarView,
  doctors: 'picked' | 'every' = 'picked',
): CalendarRead {
  const navigation = useAppointmentsNavigation();
  const { preferences } = usePreferences();
  const range = appointmentViewRange(view, navigation.anchor);
  const read = useAppointmentRange(
    appointmentRangeParamsOf(navigation.search, {
      ...range,
      branchIds: preferences.branchFilter,
      doctors,
    }),
    { notifyOnError: false },
  );
  useListLoadError(read, 'appointments');
  return {
    range,
    rows: read.data ?? [],
    pending: read.isPending,
    refreshing: read.isPlaceholderData,
  };
}
