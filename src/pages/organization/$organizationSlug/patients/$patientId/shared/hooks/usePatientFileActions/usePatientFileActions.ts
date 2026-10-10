import { useParams } from '@tanstack/react-router';

import { organizationAppointment } from '@/lib/routes/appointments-builders.ts';
import {
  organizationPatientSection,
  organizationPrescriptionCreate,
  organizationReportCreate,
  organizationTreatmentCreate,
} from '@/lib/routes/patient-file-builders.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientNextVisit } from '@/shared/api/clinic/patient-file-contracts.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import {
  passesPatientFileGate,
  type PatientFileSectionSlug,
} from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import {
  type AppIcon,
  Calendar,
  Camera,
  ClipboardList,
  FileIcon,
  MessageSquare,
  Sparkles,
} from '@/shared/icons/index.ts';

import { usePatientFileContext } from '../../patient-file-context.ts';

/**
 * The Add-to-record menu's items, in its order (H:4865; `patient-file.md:267`). Invoice and
 * Payment come back with Payments on clinozy-be: its drawers still read the fixture patients
 * (D152).
 */
export const PATIENT_ADD_ITEMS = [
  'prescription',
  'treatment',
  'photo',
  'appointment',
  'report',
  'note',
] as const;

/** One Add-to-record item. */
export type PatientAddItemId = (typeof PATIENT_ADD_ITEMS)[number];

/** Each item's 26px tile: its tone and icon (H:4865; `patient-file.md:427`). */
export const PATIENT_ADD_ITEM_LOOK: Readonly<
  Record<PatientAddItemId, { tone: Tone; icon: AppIcon }>
> = {
  prescription: { tone: 'sage', icon: FileIcon },
  treatment: { tone: 'lav', icon: Sparkles },
  photo: { tone: 'blush', icon: Camera },
  appointment: { tone: 'sky', icon: Calendar },
  report: { tone: 'stone', icon: ClipboardList },
  note: { tone: 'stone', icon: MessageSquare },
};

/** An item the member may use, with what picking it does. */
export interface PatientAddItem {
  id: PatientAddItemId;
  tone: Tone;
  icon: AppIcon;
  run: () => void;
}

/**
 * Each section's split primary "New …" (H:4746–4764; `patient-file.md:512`):
 * the Add-menu item it runs. Overview, Clinical notes, Packages (a package
 * comes from its invoice — G4) and Team notes have none; Invoices and Payments
 * come back with Payments on clinozy-be.
 */
export const SECTION_PRIMARY_ITEM: Readonly<
  Partial<Record<PatientFileSectionSlug, PatientAddItemId>>
> = {
  visits: 'appointment',
  prescriptions: 'prescription',
  treatments: 'treatment',
  images: 'photo',
  reports: 'report',
};

/** What the file's add actions read: the access in force and the open file. */
export interface PatientFileActions {
  /** The items the member may use (each checks its own permission; Q-F: none hides "+"). */
  items: PatientAddItem[];
  /** The item a section's "New …" runs, when the section has one the member may use. */
  primaryFor: (section: PatientFileSectionSlug) => PatientAddItem | null;
  /**
   * Move a booked visit: the appointment form in `mode=reschedule`, the file
   * behind it (`from`) — the rail's Up next and the Overview's Visits card.
   */
  reschedule: (visit: Pick<PatientNextVisit, 'appointmentId'>) => void;
}

/**
 * The patient file's add actions (KICKOFF §6.6 Add-to-record menu; the
 * sections' split "New …"): each item checks its own permission — the
 * Rx and treatment gates (the member's `patient_prescription:create` /
 * `patient_treatment:create`), appointments create for a booking, patients
 * create or edit for a photo, a report or a note — and runs its action: the
 * record's drawer keeping the file behind it (`from`, §4), the appointment form
 * for this patient's person, or the section.
 */
export function usePatientFileActions(): PatientFileActions {
  const navigate = useClinicNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, file, section, photos } = usePatientFileContext();
  const access = useClinicAccess();
  const referrer = section ? `patients/${patientId}/${section}` : null;

  const can = (
    area: 'patients' | 'payments' | 'appointments',
    action: 'create' | 'edit',
  ) => access.isResolved && access.can(area, action);
  const passes = (gate: 'prescriptions' | 'treatments') =>
    access.isResolved && passesPatientFileGate(access, gate);

  const openSection = (target: PatientFileSectionSlug) => () =>
    void navigate(organizationPatientSection(organizationSlug, patientId, target));
  const go = (navigation: ReturnType<typeof clinicCommandNavigation>) =>
    void navigate(navigation);

  const actions: Record<PatientAddItemId, { allowed: boolean; run: () => void }> = {
    prescription: {
      allowed: passes('prescriptions'),
      run: () =>
        void navigate(organizationPrescriptionCreate(organizationSlug, patientId)),
    },
    treatment: {
      allowed: passes('treatments'),
      run: () => void navigate(organizationTreatmentCreate(organizationSlug, patientId)),
    },
    photo: {
      allowed: can('patients', 'create'),
      // The picker first, inside the click — the browser opens it only there.
      run: () => {
        photos.pick('general');
        openSection('images')();
      },
    },
    appointment: {
      allowed: can('appointments', 'create'),
      run: () =>
        go(
          clinicCommandNavigation('newAppointment', {
            organizationSlug,
            referrer,
            // The booking is the person's (`who=` a contact id).
            search: file ? { who: file.patient.contactId } : {},
          }),
        ),
    },
    report: {
      allowed: can('patients', 'edit'),
      run: () => void navigate(organizationReportCreate(organizationSlug, patientId)),
    },
    note: { allowed: can('patients', 'create'), run: openSection('notes') },
  };

  const items = PATIENT_ADD_ITEMS.filter((id) => actions[id].allowed).map((id) => ({
    id,
    ...PATIENT_ADD_ITEM_LOOK[id],
    run: actions[id].run,
  }));

  return {
    items,
    reschedule: (visit) =>
      void navigate({
        ...organizationAppointment(organizationSlug, visit.appointmentId),
        search: { mode: 'reschedule', ...(referrer ? { from: referrer } : {}) },
      }),
    primaryFor: (target) => {
      const id = SECTION_PRIMARY_ITEM[target];
      return items.find((item) => item.id === id) ?? null;
    },
  };
}
