import { useParams, useSearch } from '@tanstack/react-router';

import { organizationAppointment } from '@/lib/routes/appointments-builders.ts';
import {
  organizationPatientEdit,
  organizationPatientSection,
} from '@/lib/routes/patient-file-builders.ts';
import { organizationPatients } from '@/lib/routes/patients-builders.ts';
import type {
  PatientFile,
  PatientNextVisit,
} from '@/shared/api/clinic/patient-file-contracts.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import {
  PATIENT_FILE_DEFAULT_SECTION,
  type PatientFileSectionSlug,
} from '@/shared/clinic/patient-file-sections.ts';
import type { ChatHistoryTarget } from '@/shared/components/ChatColumn/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { useOpenVisit, useStartVisit } from '@/shared/hooks/useVisits/index.ts';

import type { RailUpNextActions } from '../../components/PatientRail/index.ts';
import { useDefaultStaff } from '../../shared/components/PatientStaffPicker/index.ts';
import { usePatientFileActions } from '../../shared/hooks/usePatientFileActions/index.ts';
import { usePatientFileContext } from '../../shared/patient-file-context.ts';

/**
 * Start visit (D18): checks in the patient's booking today, else books a walk-in with their usual
 * doctor (else the signed-in member), then opens the flow. Undefined — hidden — unless `shown`:
 * the Overview is the member's, no visit is open and they may move a booking.
 */
function useStartVisitAction({
  file,
  shown,
  onStarted,
}: {
  file: PatientFile | undefined;
  shown: boolean;
  onStarted: () => void;
}) {
  const start = useStartVisit();
  const doctor = useDefaultStaff('doctor', file?.patient.doctorId);
  if (!(file && shown)) return undefined;
  const patientId = file.patient.id;
  return () => start.mutate({ patientId, doctorId: doctor.id }, { onSuccess: onStarted });
}

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

/**
 * The patient file's links (KICKOFF §6.6): its sections, the Patients list,
 * Edit patient over the open section, and the drawers of other rooms —
 * the appointment form (new for this patient's person, or the next visit to
 * reschedule) and Receive payment for her (the rail's Collect,
 * `payment:create`) — each keeping the file behind it through `from` (§4, AMBER
 * A-P1). Each is left out when access says no.
 */
export function usePatientFileNavigation(): PatientFileNavigation {
  const navigate = useClinicNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search: { visit?: 'open' } = useSearch({ strict: false });
  const { patientId, file, section, viewable } = usePatientFileContext();
  const access = useClinicAccess();
  const money = usePaymentAccess();
  const actions = usePatientFileActions();
  const openVisit = useOpenVisit(patientId).data ?? null;
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
  const can = (area: 'patients' | 'appointments', action: 'create' | 'edit') =>
    access.isResolved && access.can(area, action);

  const openSection = (target: PatientFileSectionSlug) =>
    void navigate(organizationPatientSection(organizationSlug, patientId, target));
  const book = () =>
    void navigate(
      clinicCommandNavigation('newAppointment', {
        organizationSlug,
        referrer,
        // The booking is the person's (`who=` a contact id).
        search: file ? { who: file.patient.contactId } : {},
      }),
    );
  const collect = () =>
    void navigate(
      clinicCommandNavigation('newReceipt', {
        organizationSlug,
        referrer,
        search: { patient: patientId },
      }),
    );
  const editContact = () =>
    void navigate({
      ...organizationPatientEdit(organizationSlug, patientId),
      search: section ? { from: section } : {},
    });
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
  const bookOrReschedule = (next: PatientNextVisit | null) =>
    next ? actions.reschedule(next) : book();

  // Each action is left undefined — a hidden control — when the member can't.
  return {
    openSection,
    backToList: () => void navigate(organizationPatients(organizationSlug)),
    startVisit: useStartVisitAction({
      file,
      shown:
        viewable.includes(PATIENT_FILE_DEFAULT_SECTION) &&
        !openVisit &&
        can('appointments', 'edit'),
      onStarted: toFlow,
    }),
    resumeVisit: openVisit && !flowShowing ? toFlow : undefined,
    editContact: can('patients', 'edit') ? editContact : undefined,
    railActions: {
      onBook: canBook ? bookOrReschedule : undefined,
      onCollect: money.canCreate ? collect : undefined,
      onFeedback: viewable.includes('overview')
        ? () => openSection('overview')
        : undefined,
    },
    openHistory,
    bookAppointment: canBook ? book : undefined,
  };
}
