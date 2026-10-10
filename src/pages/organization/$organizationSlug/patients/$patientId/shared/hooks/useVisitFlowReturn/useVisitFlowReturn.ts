import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import {
  isSessionDue,
  stageAfterRecord,
  type VisitRecord,
  type VisitRecordKind,
} from '@/shared/api/clinic/visits-contracts.ts';
import { CLINIC_SECTION_ROUTES } from '@/shared/clinic/clinic-home.ts';
import { VISIT_REFERRER } from '@/shared/clinic/clinic-referrer.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { useTodayMoves } from '@/shared/hooks/useTodayFloor/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';
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
  /**
   * Move the open visit on after a record written in it (Q8 — the plan's proposal, pending the
   * user: the client calls `…/stage` after the write): an Rx to Treatment while a session is
   * due, else to Checkout; a session to Checkout; never backwards, nothing outside the flow.
   */
  advanceAfter: (kind: VisitRecordKind) => void;
}

/**
 * The visit's stage move after a record (Q8): what decides whether a session is still due — the
 * sessions recorded at it and the patient's packages (the server's counts) — read only in the
 * flow, and Today's own stage move.
 */
function useAdvanceAfter(patientId: string, visit: VisitRecord | null) {
  const { viewable } = usePatientFileContext();
  const reads = visit !== null;
  const packages = usePatientPackages(patientId, { enabled: reads });
  const treatments = usePatientTreatments(patientId, {
    enabled: reads && viewable.includes('treatments'),
    // Only a stage decision reads it; the flow's Treatment card shows its failure.
    notifyOnError: false,
  });
  const { moveStage } = useTodayMoves();
  const { mutate } = moveStage;
  return useCallback(
    (kind: VisitRecordKind) => {
      if (!visit) return;
      const sessionRecorded = (treatments.data ?? []).some(
        (row) => row.appointmentId === visit.appointmentId && row.status === 'done',
      );
      const sessionDue = isSessionDue({
        visit,
        sessionRecorded,
        packages: packages.data ?? [],
      });
      const stage = stageAfterRecord(kind, { visit, sessionDue });
      if (stage) mutate({ appointmentId: visit.appointmentId, stage });
    },
    [visit, treatments.data, packages.data, mutate],
  );
}

/**
 * The visit flow's place in the URL (KICKOFF §6.6; L-64): a record drawer opened from the flow
 * (`prescriptions/create?visit=open`) knows the open visit — the booking a new record is written
 * at — moves it on once it has written one, and closes back to the flow; the flow's exits
 * (Pause, Complete visit) and the file's way back return to Today when Today's card opened it
 * (`from=today`).
 */
export function useVisitFlowReturn(): VisitFlowReturn {
  const search: { visit?: unknown; from?: unknown } = useSearch({ strict: false });
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const navigate = useNavigate();
  const inFlow = search.visit === 'open';
  const fromToday = search.from === VISIT_REFERRER;
  const open = useOpenVisit(inFlow ? patientId : '');
  const visit = inFlow ? (open.data ?? null) : null;
  const advanceAfter = useAdvanceAfter(patientId, visit);

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
    visit,
    ready: !(inFlow && open.isPending),
    fromToday,
    backToFlow,
    leaveFlow,
    advanceAfter,
  };
}
