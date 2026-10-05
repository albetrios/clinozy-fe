import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import type { VisitRecord } from '@/shared/api/clinic/visits-contracts.ts';
import { CLINIC_SECTION_ROUTES } from '@/shared/clinic/clinic-home.ts';
import { VISIT_REFERRER } from '@/shared/clinic/clinic-referrer.ts';
import { useOpenVisit } from '@/shared/hooks/useVisits/index.ts';

import { usePatientFileContext } from '../../patient-file-context.ts';

/** The params the visit flow keeps across the file: the flow open, and Today when it came from there. */
export interface VisitFlowSearch {
  visit: 'open';
  from?: typeof VISIT_REFERRER;
}

/**
 * The search that keeps the visit flow open across a record drawer (the Rx,
 * the treatment) and carries its way back — `from=today` when Today's card
 * opened it (KICKOFF §6.6; L-64).
 */
export function visitFlowSearch(from: unknown): VisitFlowSearch {
  return from === VISIT_REFERRER ? { visit: 'open', from } : { visit: 'open' };
}

/** What the visit flow's links and the drawers it opens read of the URL. */
export interface VisitFlowReturn {
  /** The drawer was opened from the flow (`?visit=open`). */
  inFlow: boolean;
  /** The patient's open visit while in the flow; null outside it or when none is open. */
  visit: VisitRecord | null;
  /** The open visit has been read (always, outside the flow). */
  ready: boolean;
  /** Today opened the flow (`from=today`): its exits go back there. */
  fromToday: boolean;
  /** Back to the flow on the Overview, keeping its way back. */
  backToFlow: () => void;
  /** Out of the flow: Today when it came from there, else the Overview. */
  leaveFlow: () => void;
}

/**
 * The visit flow's place in the URL (KICKOFF §6.6, D18; L-64): a record drawer
 * opened from the flow (`prescriptions/create?visit=open`) knows the open visit
 * — the booking a new Rx is written at — and closes back to the flow; the
 * flow's exits (Pause, Complete visit) and the file's way back return to Today
 * when Today's card opened it (`from=today`).
 */
export function useVisitFlowReturn(): VisitFlowReturn {
  const search: { visit?: unknown; from?: unknown } = useSearch({ strict: false });
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const navigate = useNavigate();
  const inFlow = search.visit === 'open';
  const fromToday = search.from === VISIT_REFERRER;
  const open = useOpenVisit(inFlow ? patientId : '');

  const backToFlow = useCallback(() => {
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, 'timeline'),
      search: visitFlowSearch(fromToday ? VISIT_REFERRER : undefined),
      replace: true,
    });
  }, [navigate, organizationSlug, patientId, fromToday]);

  const leaveFlow = useCallback(() => {
    if (fromToday) {
      void navigate({ to: CLINIC_SECTION_ROUTES.today, params: { organizationSlug } });
      return;
    }
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, 'timeline'),
      search: {},
      replace: true,
    });
  }, [navigate, organizationSlug, patientId, fromToday]);

  return {
    inFlow,
    visit: inFlow ? (open.data ?? null) : null,
    ready: !(inFlow && open.isPending),
    fromToday,
    backToFlow,
    leaveFlow,
  };
}
