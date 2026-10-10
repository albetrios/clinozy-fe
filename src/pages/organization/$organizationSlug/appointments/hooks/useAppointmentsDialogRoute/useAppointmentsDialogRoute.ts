import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationAppointments } from '@/lib/routes/appointments-builders.ts';
import {
  appointmentQueryKeys,
  fetchAppointment,
} from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteLocation } from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from '../../appointments.constants.ts';
import {
  type AppointmentCreateSearch,
  validateAppointmentCreateSearch,
  validateAppointmentSearch,
} from '../../appointments.dialog-search.ts';
import { validateAppointmentsSearch } from '../../appointments.search.ts';

/**
 * A booking's prefill (`S:27`): the create route's own params, and the page's
 * day and doctor.
 */
export interface AppointmentPrefill extends AppointmentCreateSearch {
  date?: string;
  doctorId?: string;
}

/** The dialog the Appointments URL opens over the page (KICKOFF §4, D24). */
export type AppointmentsDialogRoute =
  | { kind: 'none' }
  /** `/appointments/create` — the form in New mode (Copy and Rebook through `copyOf`). */
  | { kind: 'create'; prefill: AppointmentPrefill }
  /** `/appointments/$appointmentId` — the form in Edit mode, or Reschedule; `appointment` arrives once loaded. */
  | {
      kind: 'appointment';
      appointmentId: string;
      mode: 'edit' | 'reschedule';
      appointment: AppointmentRow | undefined;
      isPending: boolean;
      /** No Edit (Therapists): a read-only drawer (Q-A16). */
      readOnly: boolean;
    };

/** The dialog, and how it closes: back to the room it came from, else the page. */
export interface AppointmentsDialogRouteState {
  dialog: AppointmentsDialogRoute;
  /**
   * Close it; `date` — a new booking's day — moves the page behind it to that
   * day (H:6051, D28).
   */
  close: (options?: { date?: string }) => void;
}

const CREATE_PATH = /\/appointments\/create\/?$/;

/**
 * Which dialog the URL opens over the Appointments page — the room's dialog
 * routes render nothing, so the page reads them here. A booking id that names
 * no booking (a stale link, a deleted one) opens nothing: the URL goes back to
 * `/appointments` in place, the page's filters kept, with "Appointment not
 * found · it may have been deleted" (`S:115`). A member without Create who
 * follows a create link lands back on the page with the permission toast.
 * `close` returns to the referrer `from` (allow-listed rooms, A-P1), else to
 * the page with its own params and nothing of the drawer's — on the new
 * booking's day after a create (H:6051). Over another room's page (A-P1,
 * `useCrossRoomDialog`) it reads the drawer's own route, and every way out
 * goes back to that page.
 */
export function useAppointmentsDialogRoute(): AppointmentsDialogRouteState {
  const routeParams = useParams({ strict: false });
  const routePathname = useLocation({ select: (location) => location.pathname });
  const routeSearch: Record<string, unknown> = useSearch({ strict: false });
  const { params, pathname, search, crossRoom } = useDialogRouteLocation({
    params: routeParams,
    pathname: routePathname,
    search: routeSearch,
  });
  const { organizationSlug = '', appointmentId } = params;
  const navigate = useNavigate();
  const { t } = useTranslation([APPOINTMENTS_NS, ERRORS_NS]);
  const access = useClinicAccess();
  const organizationId = useOrganizationStore((state) => state.organizationId);

  const backToPage = useCallback(
    (date?: string) => {
      if (crossRoom) {
        crossRoom.close();
        return;
      }
      void navigate({
        ...organizationAppointments(organizationSlug),
        // The page's own params only: the drawer's (`time`, `who`, `mode` …) close with it.
        search: (current: Record<string, unknown>) => ({
          ...validateAppointmentsSearch(current),
          ...(date ? { date } : {}),
        }),
        hash: true,
        replace: true,
      });
    },
    [crossRoom, navigate, organizationSlug],
  );
  const leaveDeadLink = useCallback(() => backToPage(), [backToPage]);

  const drawer = useDialogRouteRecord({
    id: appointmentId,
    queryKey: (id) => appointmentQueryKeys.detail(organizationId, id),
    fetchRecord: fetchAppointment,
    recordLabel: t(APPOINTMENTS_KEYS.record, { ns: APPOINTMENTS_NS }),
    onMissing: leaveDeadLink,
  });

  const isCreate = appointmentId === undefined && CREATE_PATH.test(pathname);
  const createRefused =
    isCreate && access.isResolved && !access.can('appointments', 'create');
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!createRefused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403, { ns: ERRORS_NS }));
    backToPage();
  }, [createRefused, pathname, backToPage, t]);

  // The drawer's params are parsed again here: from the page's own match the
  // router hands back the URL's raw values, not the dialog route's.
  const from = safeReferrer(
    (appointmentId === undefined
      ? validateAppointmentCreateSearch(search)
      : validateAppointmentSearch(search)
    ).from,
    '',
  );
  const close = useCallback(
    (options?: { date?: string }) => {
      if (from && !crossRoom) {
        void navigate({ href: `/organization/${organizationSlug}/${from}` });
        return;
      }
      backToPage(options?.date);
    },
    [crossRoom, from, navigate, organizationSlug, backToPage],
  );

  if (appointmentId !== undefined) {
    if (!drawer.isOpen) return { dialog: { kind: 'none' }, close };
    return {
      dialog: {
        kind: 'appointment',
        appointmentId,
        mode: validateAppointmentSearch(search).mode ?? 'edit',
        appointment: drawer.record,
        isPending: drawer.isPending,
        readOnly: access.isResolved && !access.can('appointments', 'edit'),
      },
      close,
    };
  }
  if (isCreate && !createRefused) {
    const page = validateAppointmentsSearch(search);
    return {
      dialog: {
        kind: 'create',
        prefill: {
          ...validateAppointmentCreateSearch(search),
          date: page.date,
          doctorId: page.doctor,
        },
      },
      close,
    };
  }
  return { dialog: { kind: 'none' }, close };
}
