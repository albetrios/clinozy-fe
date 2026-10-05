import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import { fetchVisit } from '@/shared/api/clinic/visits-api.ts';
import { notify } from '@/shared/notify/index.ts';

import { CLINIC_KEYS, CLINIC_NS } from './clinic.constants.ts';
import { CLINIC_SECTION_ROUTES } from './clinic-home.ts';

/** The room a visit link goes back to — and the patient page's way back (`from`). */
export const VISIT_REFERRER = 'today';

/** A navigation to where a visit's work happens, as `navigate()` and `redirect()` take it. */
export interface VisitNavigation {
  to: string;
  params: Record<string, string>;
  search?: Record<string, string>;
}

/** An old visit link's redirect: its navigation, replacing the link in the history. */
export type VisitRedirect = VisitNavigation & { replace: true };

/**
 * The patient's own page with the visit flow open (KICKOFF §6.6, D18): the
 * Overview on `timeline?visit=open`, Today as the way back (`from=today`). The
 * flow holds what the Visit sheet did — the Rx through the Prescription drawer,
 * the session, the bill and the collection — and a closed visit just leaves
 * the Overview (the page drops a stale `visit=open`).
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
 * Where an old Visit sheet link lands (`/visits/$visitId?tab=…`, L-64: the
 * sheet is gone): the visit's patient's page with the flow open. A visit the
 * server doesn't know, or one with no patient record yet, goes to Today with
 * "Visit not found · it may have been deleted".
 */
export async function visitRedirect(
  organizationSlug: string,
  visitId: string,
): Promise<VisitRedirect> {
  const patientId = await fetchVisit(visitId).then(
    (visit) => visit.person.patientId,
    () => null,
  );
  if (patientId) {
    return { ...patientVisitTarget(organizationSlug, patientId), replace: true };
  }
  await i18n.loadNamespaces([CLINIC_NS, ERRORS_NS]);
  notify.info(
    i18n.t(ERRORS_KEYS.route.recordNotFound, {
      ns: ERRORS_NS,
      record: i18n.t(CLINIC_KEYS.visits.record, { ns: CLINIC_NS }),
    }),
  );
  return {
    to: CLINIC_SECTION_ROUTES.today,
    params: { organizationSlug },
    replace: true,
  };
}
