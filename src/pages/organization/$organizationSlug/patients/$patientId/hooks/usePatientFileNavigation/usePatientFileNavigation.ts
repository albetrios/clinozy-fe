import { useNavigate, useParams, useSearch } from '@tanstack/react-router';

import { organizationAppointment, organizationPatients } from '@/lib/routes/index.ts';
import {
  organizationPatientEdit,
  organizationPatientSection,
} from '@/lib/routes/patient-file-builders.ts';
import type { PatientNextVisit } from '@/shared/api/clinic/patient-file-contracts.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import {
  PATIENT_FILE_DEFAULT_SECTION,
  type PatientFileSectionSlug,
} from '@/shared/clinic/patient-file-sections.ts';
import type { ChatHistoryTarget } from '@/shared/components/ChatColumn/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useOpenVisit, useStartVisit } from '@/shared/hooks/useVisits/index.ts';

import type { RailUpNextActions } from '../../components/PatientRail/index.ts';
import { usePatientFileActions } from '../../shared/hooks/usePatientFileActions/index.ts';
import { usePatientFileContext } from '../../shared/patient-file-context.ts';

/** Where the file's own links go — each hidden (undefined) when the member can't. */
export interface PatientFileNavigation {
  openSection: (section: PatientFileSectionSlug) => void;
  /** Back to the Patients list (the Back button, the breadcrumb, Esc). */
  backToList: () => void;
  /**
   * "Start visit" (D18): the patient's open visit, else a new one — today's
   * booking checked in when it is not yet — and the flow on the Overview
   * (`timeline?visit=open`). Hidden while a visit is open.
   */
  startVisit?: () => void;
  /** "Visit in progress · Resume": back to the flow — while a visit is open and the flow isn't showing. */
  resumeVisit?: () => void;
  /** The rail's "Edit contact" → `edit/` over this section (A-F1). */
  editContact?: () => void;
  /** The rail's Up next: Book / Reschedule, Collect, Feedback. */
  railActions: RailUpNextActions;
  /** A history chip in the Activity column: the appointment or the section. */
  openHistory: (target: ChatHistoryTarget) => void;
  /** "Book an appointment" in the Activity column. */
  bookAppointment?: () => void;
}

/** `action` when the member may, else nothing — a hidden control. */
function when<A>(allowed: boolean, action: A): A | undefined {
  return allowed ? action : undefined;
}

/**
 * The patient file's links (KICKOFF §6.6): its sections, the Patients list,
 * Edit patient over the open section, and the drawers of other rooms —
 * the appointment form (new for this patient, or the next visit to
 * reschedule) and Receive payment — each keeping the file behind it through
 * `from` (§4, AMBER A-P1). Each is left out when access says no.
 */
export function usePatientFileNavigation(): PatientFileNavigation {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search: { visit?: 'open' } = useSearch({ strict: false });
  const { patientId, section, viewable } = usePatientFileContext();
  const access = useClinicAccess();
  const actions = usePatientFileActions();
  const openVisit = useOpenVisit(patientId).data ?? null;
  const start = useStartVisit();
  const flowShowing = section === PATIENT_FILE_DEFAULT_SECTION && search.visit === 'open';
  const toFlow = () =>
    void navigate({
      ...organizationPatientSection(
        organizationSlug,
        patientId,
        PATIENT_FILE_DEFAULT_SECTION,
      ),
      search: { visit: 'open' },
    });
  const referrer = section ? `patients/${patientId}/${section}` : null;
  const from = referrer ? { from: referrer } : {};
  const can = (
    area: 'patients' | 'payments' | 'appointments',
    action: 'create' | 'edit',
  ) => access.isResolved && access.can(area, action);

  const openSection = (target: PatientFileSectionSlug) =>
    void navigate(organizationPatientSection(organizationSlug, patientId, target));
  const book = () =>
    void navigate(
      clinicCommandNavigation('newAppointment', {
        organizationSlug,
        referrer,
        search: { who: patientId },
      }),
    );
  const editContact = () =>
    void navigate({
      ...organizationPatientEdit(organizationSlug, patientId),
      search: section ? { from: section } : {},
    });
  const collect = () =>
    void navigate(
      clinicCommandNavigation('newReceipt', {
        organizationSlug,
        referrer,
        search: { patient: patientId },
      }),
    );
  const openHistory = (target: ChatHistoryTarget) => {
    if (target.kind === 'patientFile') {
      openSection(target.section);
      return;
    }
    void navigate({
      ...organizationAppointment(organizationSlug, target.appointmentId),
      search: from,
    });
  };
  const canBook = can('appointments', 'create');

  return {
    openSection,
    backToList: () => void navigate(organizationPatients(organizationSlug)),
    startVisit: when(viewable.includes(PATIENT_FILE_DEFAULT_SECTION) && !openVisit, () =>
      start.mutate({ patientId }, { onSuccess: toFlow }),
    ),
    resumeVisit: when(Boolean(openVisit) && !flowShowing, toFlow),
    editContact: when(can('patients', 'edit'), editContact),
    railActions: {
      onBook: when(canBook, (next: PatientNextVisit | null) =>
        next ? actions.reschedule(next) : book(),
      ),
      onCollect: when(can('payments', 'create'), collect),
      onFeedback: when(viewable.includes('overview'), () => openSection('overview')),
    },
    openHistory,
    bookAppointment: when(canBook, book),
  };
}
