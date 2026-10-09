import { useState } from 'react';

import { isAppointmentSlotLocked } from '@/shared/api/clinic/appointment-status.ts';
import type {
  AppointmentConnectedLead,
  AppointmentPackageOption,
  AppointmentPersonLookup,
  AppointmentRow,
  AppointmentSlot,
  AppointmentSlotStep,
  AppointmentStaff,
  AvailableSlotsParamsInput,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';
import {
  useActivePackages,
  useAppointment,
  useAvailableSlots,
  useBookableStaff,
  useBookingPerson,
  useConnectedLeads,
} from '@/shared/hooks/useAppointments/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

import {
  applyAppointmentChange,
  type AppointmentDraft,
  type AppointmentFormChange,
  type AppointmentFormMode,
  type AppointmentFormPrefill,
  emptyDraft,
  isDraftDirty,
  newDraftOf,
  rebaseDraft,
  savedDraftOf,
  type SavedSlot,
  startingDoctorId,
  type WhoDraft,
} from './appointment-form-model.ts';

/** What opens the form: its mode, the booking (Edit, Reschedule), the prefill (New). */
export interface AppointmentFormInput {
  /** New (`create/`, a stacked booking), Edit or Reschedule (`$appointmentId/`). */
  mode: AppointmentFormMode;
  /**
   * Edit and Reschedule: the booking's id, known before the booking loads —
   * another id is another opening.
   */
  appointmentId?: string;
  /** Edit and Reschedule: the booking — the drawer shows its skeleton until it loads. */
  appointment?: AppointmentRow;
  prefill?: AppointmentFormPrefill;
  /** No Edit on Appointments: a read-only drawer (Q-A16). */
  readOnly?: boolean;
}

/** The draft, where it started, and the saved booking it was read from. */
interface DraftSession {
  start: AppointmentDraft;
  draft: AppointmentDraft;
  base: AppointmentRow | undefined;
}

/** One opening of the form: what it loaded, its draft, and what follows from both. */
export interface AppointmentFormState {
  /** The mode it runs in — a Reschedule of a booking that can no longer move is an Edit. */
  mode: AppointmentFormMode;
  /** The saved booking (Edit, Reschedule). */
  row: AppointmentRow | undefined;
  prefill: AppointmentFormPrefill;
  readOnly: boolean;
  today: string;
  /** Whether the first draft exists — the drawer shows its skeleton until then. */
  started: boolean;
  draft: AppointmentDraft;
  change: (change: AppointmentFormChange) => void;
  /** The draft differs from where it started (Q-P1). */
  dirty: boolean;
  staff: readonly AppointmentStaff[];
  offerings: readonly OfferingRecord[];
  branchId: string | null;
  /** The person's connected leads (`S:330`). */
  leads: readonly AppointmentConnectedLead[];
  /** The patient's active packages. */
  packages: readonly AppointmentPackageOption[];
  isPatient: boolean;
  saved: SavedSlot | null;
  /** Date & time locked — checked in or later (`S:352`). */
  locked: boolean;
  slots: readonly AppointmentSlot[] | undefined;
  slotStep: AppointmentSlotStep;
  setSlotStep: (step: AppointmentSlotStep) => void;
  canEdit: boolean;
  /** Cancelled or No show: final, the form reads. */
  closed: boolean;
  /** Read-only or closed — every control inert. */
  inert: boolean;
  edit: boolean;
  /** The member's roles — a Private photo album is the doctors' and admins'. */
  roles: readonly string[];
}

const NO_PREFILL: AppointmentFormPrefill = {};
const NO_LEADS: readonly AppointmentConnectedLead[] = [];
const NO_PACKAGES: readonly AppointmentPackageOption[] = [];
const NO_STAFF: readonly AppointmentStaff[] = [];
const NO_OFFERINGS: readonly OfferingRecord[] = [];

/** Reschedule is a move: a booking that can no longer move opens as Edit. */
function effectiveMode(
  mode: AppointmentFormMode,
  row: AppointmentRow | undefined,
): AppointmentFormMode {
  if (mode === 'reschedule' && row && isAppointmentSlotLocked(row.status)) return 'edit';
  return mode;
}

/** The person's leads are looked up by their ids and mobile — a new contact has none. */
function lookupOf(who: WhoDraft | null): AppointmentPersonLookup | null {
  if (!who || who.kind === 'new') return null;
  return { patientId: who.patientId, leadId: who.leadId, phone: who.phone };
}

/** The doctor's starts that day — asked once a date and a doctor are set, never once locked. */
function slotQueryOf(
  draft: AppointmentDraft,
  context: {
    locked: boolean;
    step: AppointmentSlotStep;
    branchId: string | null;
    exceptId: string | undefined;
  },
): AvailableSlotsParamsInput | null {
  if (!(draft.date && draft.doctorId) || context.locked) return null;
  return {
    date: draft.date,
    doctorId: draft.doctorId,
    durationMin: draft.durationMin,
    step: context.step,
    ...(context.branchId ? { branchId: context.branchId } : {}),
    ...(context.exceptId ? { exceptId: context.exceptId } : {}),
  };
}

/** The saved booking's slot and status. */
const savedOf = (row: AppointmentRow | undefined): SavedSlot | null =>
  row ? { date: row.date, time: row.startTime, status: row.status } : null;

/** What a New form loads before its first draft — the person, the booking it copies. */
function useNewFormSources(mode: AppointmentFormMode, prefill: AppointmentFormPrefill) {
  const create = mode === 'create';
  const person = useBookingPerson(create ? prefill.whoId : undefined);
  const source = useAppointment(create ? prefill.copyOf : undefined);
  const settled =
    (!prefill.whoId || person.isFetched) && (!prefill.copyOf || source.isFetched);
  return { person: person.data, source: source.data, settled };
}

/**
 * The branch a booking files under (`S:331`). Its default doctor is not offered: the member's
 * branch list (`GET /app/branches/my`) does not carry it (api-integration §8 G5).
 */
function useBookingBranch(row: AppointmentRow | undefined) {
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  return {
    branchId: row?.branchId ?? defaultBranchId(openBranches, preferences.branchFilter),
  };
}

/**
 * The draft and where it started. The first draft is made once everything it
 * reads has loaded; when the saved booking changes under the form (a status
 * written here, a patient linked) the untouched fields follow it.
 */
function useDraftSession({
  ready,
  row,
  mode,
  today,
  startNew,
}: {
  ready: boolean;
  row: AppointmentRow | undefined;
  mode: AppointmentFormMode;
  today: string;
  startNew: () => AppointmentDraft;
}) {
  const [session, setSession] = useState<DraftSession | null>(null);
  if (ready && session === null) {
    const start = row ? savedDraftOf(row, mode, today) : startNew();
    setSession({ start, draft: start, base: row });
  }
  if (session?.base && row && row.updatedAt !== session.base.updatedAt) {
    const next = savedDraftOf(row, mode, today);
    setSession({
      start: next,
      draft: rebaseDraft(session.draft, session.start, next),
      base: row,
    });
  }
  const change = (next: AppointmentFormChange) =>
    setSession((current) =>
      current
        ? { ...current, draft: applyAppointmentChange(current.draft, next) }
        : current,
    );
  return { session, change };
}

/** The staff and offerings the form picks from, and whether the staff has loaded. */
function useCatalogs() {
  const staff = useBookableStaff();
  const offerings = useOfferings();
  return {
    staff: staff.data ?? NO_STAFF,
    staffFetched: staff.isFetched,
    offerings: offerings.data ?? NO_OFFERINGS,
  };
}

/** What the saved booking leaves editable: a Cancelled or No-show one is final. */
function bookingFlags(
  row: AppointmentRow | undefined,
  readOnly: boolean,
  mayEdit: boolean,
) {
  const closed = row?.status === 'cancelled' || row?.status === 'no_show';
  return { closed, inert: readOnly || closed, canEdit: !readOnly && mayEdit };
}

/** What hangs off the draft: the person's leads, a patient's packages, the free slots. */
function useDraftReads(
  draft: AppointmentDraft,
  row: AppointmentRow | undefined,
  branchId: string | null,
) {
  const who = draft.who;
  const isPatient = who?.kind === 'patient';
  const leads = useConnectedLeads(lookupOf(who)).data ?? NO_LEADS;
  const patientId = isPatient ? who.patientId : null;
  const packages = useActivePackages(patientId).data ?? NO_PACKAGES;
  const locked = row !== undefined && isAppointmentSlotLocked(draft.status);
  const [slotStep, setSlotStep] = useState<AppointmentSlotStep>(30);
  const slots = useAvailableSlots(
    slotQueryOf(draft, { locked, step: slotStep, branchId, exceptId: row?.id }),
  );
  return {
    isPatient,
    leads,
    packages,
    locked,
    slots: slots.data,
    slotStep,
    setSlotStep,
  };
}

/** A New form's first draft, its doctor the first one known (`startingDoctorId`). */
function startNewDraft({
  prefill,
  sources,
  firstStaffId,
  today,
}: {
  prefill: AppointmentFormPrefill;
  sources: ReturnType<typeof useNewFormSources>;
  firstStaffId: string | undefined;
  today: string;
}): AppointmentDraft {
  return newDraftOf(prefill, {
    person: sources.person,
    source: sources.source,
    today,
    doctorId: startingDoctorId([
      prefill.doctorId,
      sources.source?.doctorId,
      sources.person?.usualDoctorId,
      firstStaffId,
    ]),
  });
}

/**
 * One opening of the appointment form (KICKOFF §6.4): the staff, offerings,
 * branch, person and copied booking it reads; the draft, started once they
 * have loaded; and the leads, packages and free slots that hang off it.
 */
export function useAppointmentFormState(
  input: AppointmentFormInput,
): AppointmentFormState {
  const [today] = useState(() => clinicToday());
  const access = useClinicAccess();
  const prefill = input.prefill ?? NO_PREFILL;
  const row = input.mode === 'create' ? undefined : input.appointment;
  const mode = effectiveMode(input.mode, row);
  const readOnly = input.readOnly ?? false;
  const catalogs = useCatalogs();
  const sources = useNewFormSources(input.mode, prefill);
  const branch = useBookingBranch(row);
  const createReady = catalogs.staffFetched && sources.settled;
  const { session, change } = useDraftSession({
    ready: row !== undefined || (input.mode === 'create' && createReady),
    row,
    mode,
    today,
    startNew: () =>
      startNewDraft({
        prefill,
        sources,
        firstStaffId: catalogs.staff[0]?.id,
        today,
      }),
  });
  const draft = session?.draft ?? emptyDraft(today);
  return {
    ...useDraftReads(draft, row, branch.branchId),
    ...bookingFlags(row, readOnly, access.can('appointments', 'edit')),
    mode,
    row,
    prefill,
    readOnly,
    today,
    started: session !== null,
    draft,
    change,
    dirty: session !== null && isDraftDirty(draft, session.start),
    staff: catalogs.staff,
    offerings: catalogs.offerings,
    branchId: branch.branchId,
    saved: savedOf(row),
    edit: mode === 'edit',
    roles: access.roles,
  };
}
