import { useQueryClient } from '@tanstack/react-query';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { clinicalNoteQueryKeys } from '@/shared/api/clinic/clinical-notes-api.ts';
import type { ClinicalNote } from '@/shared/api/clinic/clinical-notes-contracts.ts';
import { contactQueryKeys } from '@/shared/api/clinic/contacts-api.ts';
import { leadQueryKeys } from '@/shared/api/clinic/leads-api.ts';
import {
  fetchPatientFile,
  patientFileQueryKeys,
} from '@/shared/api/clinic/patient-file-api.ts';
import {
  fetchOpenVisit,
  fetchVisitCheckNotes,
  recordVisitCheck,
  removeVisitCheck,
  setVisitPaused,
  startVisit,
  VISIT_WRITE_KEYS,
  type VisitCheckTarget,
  visitQueryKeys,
} from '@/shared/api/clinic/visits-api.ts';
import {
  VISIT_CHECK_NOTE_TEXTS,
  type VisitCheck,
  type VisitRecord,
} from '@/shared/api/clinic/visits-contracts.ts';
import { AppError } from '@/shared/errors/AppError.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { usePatientFile } from '@/shared/hooks/usePatientFile/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * The visit's server state on clinozy-be (api-integration §5.1, §5.4): the patient's open visit
 * — today's checked-in booking of their person — Start visit (a check-in, or a walk-in), the
 * pause, and the safety checks (`safety_check` notes at the visit). The visit's stage and its
 * complete are the appointments' and Today's own writes (`useMoveAppointment`, `useTodayMoves`).
 * Writes toast only their errors; the screens toast success in their own words.
 */

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

// ── Reads ──

/**
 * The patient's open visit — today's checked-in booking of their person — or null; idle without
 * a patient, and until the member's access has answered. The person comes from the file's read
 * (the entry the file itself shows), so the visit is asked for once the file has answered.
 */
export function useOpenVisit(patientId: string) {
  const organizationId = useOrganizationId();
  const access = useClinicAccess();
  const file = usePatientFile(patientId === '' ? undefined : patientId);
  const contactId = file.data?.patient.contactId ?? '';
  // A member who can't read the bookings (`appointment:read`) sees no open visit — asked nothing.
  const reads = access.can('appointments', 'view');
  return useAppQuery({
    queryKey: [...visitQueryKeys.open(organizationId, contactId), reads],
    queryFn: () => (reads ? fetchOpenVisit(contactId) : Promise.resolve(null)),
    enabled: contactId !== '' && organizationId !== null && access.isResolved,
  });
}

/**
 * The visit's safety-check notes, oldest first (`GET …/clinical-notes?kind=safety_check&
 * appointment_id=`); idle without a visit, or while `enabled` is false — a member without
 * `patient:clinical_record:read` asks nothing. No toast: the flow shows the failure in its card.
 */
export function useVisitChecks(
  target: VisitCheckTarget | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const organizationId = useOrganizationId();
  const patientId = target?.patientId ?? '';
  const appointmentId = target?.appointmentId ?? '';
  return useAppQuery({
    queryKey: visitQueryKeys.checks(organizationId, patientId, appointmentId),
    queryFn: () => fetchVisitCheckNotes({ patientId, appointmentId }),
    enabled:
      enabled && patientId !== '' && appointmentId !== '' && organizationId !== null,
    // Shown in place: the checks card's Retry.
    notifyOnError: false,
  });
}

// ── Writes ──

/** What a Start visit sends: the patient and, for a walk-in, the doctor the file defaults to. */
export interface StartVisitVars {
  patientId: string;
  /**
   * The walk-in's doctor — the file's default doctor; without one, the patient's usual doctor,
   * else the signed-in member.
   */
  doctorId?: string | null;
}

/**
 * "Start visit": the open visit, else today's booking checked in, else a walk-in at the patient's
 * home branch (`startVisit`). Not optimistic; the caller opens the flow once it lands and the open
 * visit has been read again. A member with no membership to book with is refused before any call
 * (403's words).
 */
export function useStartVisit() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  const me = useMyMembershipId();
  return useAppMutation<void, StartVisitVars>({
    mutationFn: async ({ patientId, doctorId }, action) => {
      const { patient } = await queryClient.query({
        queryKey: patientFileQueryKeys.detail(organizationId, patientId),
        queryFn: () => fetchPatientFile(patientId),
        staleTime: 'static',
      });
      const doctor = doctorId ?? patient.doctorId ?? me;
      if (!doctor) {
        throw new AppError(
          i18n.t(ERRORS_KEYS.api.http403, { ns: ERRORS_NS }),
          403,
          'NO_MEMBERSHIP',
        );
      }
      await startVisit({
        contactId: patient.contactId,
        branchId: patient.homeBranchId,
        doctorId: doctor,
        idempotencyKey: action.idempotencyKey,
      });
      // The flow opens on success: the open visit must be read again first, or the file finds
      // none yet and closes the flow it was asked to open.
      await queryClient.refetchQueries({
        queryKey: visitQueryKeys.open(organizationId, patient.contactId),
      });
    },
    // A check-in moves the person's open lead on and writes its activity line.
    invalidateKeys: [...VISIT_WRITE_KEYS, leadQueryKeys.all, contactQueryKeys.all],
  });
}

/** What a pause or a resume sends. */
export interface VisitPauseVars {
  appointmentId: string;
  /** Pause (true) or resume (false). */
  paused: boolean;
}

/** Pause the visit ("Pause" leaves the flow, the visit open) or resume it — not optimistic. */
export function useSetVisitPaused() {
  return useAppMutation<VisitRecord, VisitPauseVars>({
    mutationFn: (vars, action) => setVisitPaused({ ...vars, ...action }),
    invalidateKeys: [...VISIT_WRITE_KEYS],
  });
}

/** A tick or an untick: which check, and the done check's note an untick removes. */
export interface VisitCheckVars {
  check: VisitCheck;
  /** The check's note — set to untick it, null to tick it. */
  noteId: string | null;
}

/**
 * A visit's cached check notes with a tick or an untick applied — the tiles answer at once. A
 * tick's note has no id until the server answers (the tile waits for it before an untick).
 */
function withVisitCheck(
  data: unknown,
  { patientId, appointmentId, check, noteId }: VisitCheckTarget & VisitCheckVars,
): unknown {
  if (!Array.isArray(data)) return data;
  const notes = data as ClinicalNote[];
  if (noteId) return notes.filter((note) => note.id !== noteId);
  const provisional: ClinicalNote = {
    id: '',
    patientId,
    kind: 'safety_check',
    text: VISIT_CHECK_NOTE_TEXTS[check],
    appointmentId,
    diagnosisId: null,
    addedAt: new Date().toISOString(),
  };
  return [...notes, provisional];
}

/**
 * Tick a safety check of the visit (its note written at it) or untick it (the note deleted with
 * the reason `not_needed`, Q24 — the tile itself is the way back). Optimistic on the visit's
 * checks, put back if refused.
 */
export function useSetVisitCheck(target: VisitCheckTarget) {
  const organizationId = useOrganizationId();
  const { patientId, appointmentId } = target;
  return useAppMutation<ClinicalNote | null, VisitCheckVars>({
    mutationFn: async ({ check, noteId }, action) => {
      if (noteId) {
        await removeVisitCheck({ patientId, noteId });
        return null;
      }
      return recordVisitCheck({ patientId, appointmentId, check, ...action });
    },
    invalidateKeys: [clinicalNoteQueryKeys.all],
    optimisticQueries: {
      queryKey: visitQueryKeys.checks(organizationId, patientId, appointmentId),
      update: (data, vars) => withVisitCheck(data, { ...target, ...vars }),
    },
  });
}
