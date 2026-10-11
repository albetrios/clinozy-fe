import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import { fetchAppointment } from '@/shared/api/app/appointments-api.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';

import { APP_KEYS, APP_NS } from './app.constants.ts';
import { APP_SECTION_ROUTES } from './app-home.ts';
import { VISIT_REFERRER } from './app-referrer.ts';

/** A navigation to where a visit's work happens, as `navigate()` and `redirect()` take it. */
export interface VisitNavigation {
  to: string;
  params: Record<string, string>;
  search?: Record<string, string>;
}

/** An old visit link's redirect: its navigation, replacing the link in the history. */
export type VisitRedirect = VisitNavigation & { replace: true };

/**
 * The patient's own page with the visit flow open (KICKOFF §6.6): the Overview on
 * `timeline?visit=open`, Today as the way back (`from=today`). A visit that is no longer open
 * just leaves the Overview (the page drops a stale `visit=open`).
 */
export function patientVisitTarget(
  organizationSlug: string,
  patientId: string,
): VisitNavigation {
  return {
    ...organizationPatientSection(organizationSlug, patientId, 'timeline'),
    search: { visit: 'open', from: VISIT_REFERRER },
  };
}

/**
 * The patient file of a visit's booking (`GET /app/appointments/:appointment_id` — its person's
 * `patient_id`): null when the server doesn't know the id — a 404, or a 400 for an id that is not
 * a booking's (the retired Visit's) — or the person has no patient file. Any other failure is
 * thrown.
 */
async function patientOfVisit(appointmentId: string): Promise<string | null> {
  try {
    return (await fetchAppointment(appointmentId)).patientId;
  } catch (error) {
    if (isHttpError(error) && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

/**
 * Where an old Visit link lands (`/visits/$visitId?tab=…`, L-64: there is no Visit resource — a
 * visit is its booking, so the id is read as a booking's): the booking's patient's page with the
 * flow open. An id the server doesn't know, or a person with no patient file, goes to Today with
 * "Visit not found · it may have been deleted". Any other failure — offline, a 5xx — is thrown,
 * for the route's error boundary to show and retry.
 */
export async function visitRedirect(
  organizationSlug: string,
  visitId: string,
): Promise<VisitRedirect> {
  const patientId = await patientOfVisit(visitId);
  if (patientId) {
    return { ...patientVisitTarget(organizationSlug, patientId), replace: true };
  }
  await i18n.loadNamespaces([APP_NS, ERRORS_NS]);
  notify.info(
    i18n.t(ERRORS_KEYS.route.recordNotFound, {
      ns: ERRORS_NS,
      record: i18n.t(APP_KEYS.visits.record, { ns: APP_NS }),
    }),
  );
  return {
    to: APP_SECTION_ROUTES.today,
    params: { organizationSlug },
    replace: true,
  };
}
