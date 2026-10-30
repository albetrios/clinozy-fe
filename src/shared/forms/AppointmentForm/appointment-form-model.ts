import type { AppointmentStatus, AppointmentType } from '@/shared/api/app/app-schema.ts';
import { clockMinutes } from '@/shared/api/app/app-time.ts';
import { isAppointmentSlotLocked } from '@/shared/api/app/appointment-status.ts';
import {
  APPOINTMENT_LENGTHS,
  APPOINTMENT_TYPE_MINUTES,
  APPOINTMENT_TYPE_SERVICES,
  type AppointmentCreateInput,
  type AppointmentFields,
  type AppointmentMoveRoute,
  type AppointmentPerson,
  type AppointmentRow,
  type AppointmentSlot,
} from '@/shared/api/app/appointments-contracts.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';

/*
 * The appointment form's model (KICKOFF §6.4 Appointment form; H:5976–6051):
 * the draft, how each control changes it (`applyAppointmentChange` — the
 * prototype's `updA`), and what the form derives from it. Pure — the form
 * holds the draft in a reducer and the tests pin every rule here.
 */

// ── Modes ──

/**
 * The form's modes: New (`create/`, Copy and Rebook through `copyOf`), Edit
 * (`$appointmentId/`) and Reschedule (`?mode=reschedule`, "Move to another
 * time").
 */
export type AppointmentFormMode = 'create' | 'edit' | 'reschedule';

/**
 * What a New form starts from (`create/?…`, `S:27`; a stacked booking): the
 * person, the day and time a slot click picked, the doctor, a booking to copy
 * — and from the lead drawer's "Book an appointment" (§6.3) its type,
 * service, length and reason, step 1 collapsed.
 */
export interface AppointmentFormPrefill {
  /** `who=<contactId>` — the person, looked up (`GET /app/contacts/:contact_id`). */
  whoId?: string;
  /** The day, clinic-local; a past day starts today. */
  date?: string;
  /** An empty Day slot's start, `HH:mm`. */
  time?: string;
  doctorId?: string;
  /** Copy and Rebook: a new booking from this one (Q-A6). */
  copyOf?: string;
  /** From a chat or a task (`source=`): step 1 collapsed, Date & time open. */
  collapsed?: boolean;
  /**
   * From a lead: the person is fixed — no "Change contact" — so the booking is theirs and moves
   * their lead to Appointment scheduled (clinozy-be L11). Someone else is booked from Appointments.
   */
  lockedWho?: boolean;
  type?: AppointmentType;
  serviceLabel?: string;
  durationMin?: number;
  reason?: string;
}

/** The length the lead drawer books with (KICKOFF §6.3). */
const LEAD_BOOKING_MINUTES = 20;
/** The reason it carries: the first 80 characters of their last message (H:5751). */
const LEAD_BOOKING_REASON = 80;

/**
 * The lead drawer's "Book an appointment" (KICKOFF §6.3; H:5751): this lead;
 * Treatment "LHR Treatment" when an interest matches `/lhr|laser/i`, else
 * Consultation; 20 min; today; no time; step 1 collapsed with Date & time
 * open; the person locked to the lead's; Reason the first 80 characters of
 * their last inbound message.
 */
export function leadBookingPrefill(
  lead: { contactId: string; interests: readonly string[] },
  reason: string | null,
): AppointmentFormPrefill {
  const laser = lead.interests.some((interest) => /lhr|laser/i.test(interest));
  return {
    whoId: lead.contactId,
    collapsed: true,
    lockedWho: true,
    ...(laser
      ? { type: 'treatment' as const, serviceLabel: 'LHR Treatment' }
      : { type: 'consultation' as const }),
    durationMin: LEAD_BOOKING_MINUTES,
    ...(reason ? { reason: reason.slice(0, LEAD_BOOKING_REASON) } : {}),
  };
}

// ── The draft ──

/**
 * Who the booking is for: a contact — a patient once their file exists, a lead
 * while they have an open one — or `new`, a person the search did not find,
 * created as a contact before the booking (`POST /app/contacts`).
 */
export interface WhoDraft {
  kind: AppointmentPerson['kind'] | 'new';
  /** The contact a booking points at; null for a new person. */
  contactId: string | null;
  name: string;
  /** E.164; a new contact's mobile is the draft's `newPhone`. */
  phone: string | null;
  patientId: string | null;
  /** Their open lead — it moves to Clinic visited at check-in. */
  leadId: string | null;
  /** "C-12345"; null for a new person. */
  contactNumber: number | null;
}

/** Everything the form edits — what a save sends. */
export interface AppointmentDraft {
  who: WhoDraft | null;
  /** A new contact's mobile, its digits (≤ 10). */
  newPhone: string;
  type: AppointmentType;
  serviceLabel: string;
  offeringId: string | null;
  doctorId: string | null;
  durationMin: number;
  reason: string;
  notes: string;
  date: string | null;
  time: string | null;
  /** The status tiles' pick (Edit) — the saved status until a tile is picked. */
  status: AppointmentStatus;
}

/** The saved booking's slot and status — what Edit compares a move with. */
export interface SavedSlot {
  date: string;
  time: string;
  status: AppointmentStatus;
}

/** The design's limits on Reason and Notes (`appointments.md:76–77`). */
export const APPOINTMENT_FORM_LIMITS = { reason: 120, notes: 200, name: 60 } as const;

/**
 * The "Common" treatments (`AP_SVC` minus the non-treatments, H:3416): stored
 * service labels with their lengths — data, as the design writes them.
 */
export const COMMON_TREATMENTS = [
  { label: 'Treatment', minutes: 60 },
  { label: 'LHR Treatment', minutes: 60 },
  { label: 'Peel', minutes: 30 },
  { label: 'Hydrafacial', minutes: 45 },
] as const;

const NON_TREATMENT_SERVICES = new Set<string>([
  APPOINTMENT_TYPE_SERVICES.consultation,
  APPOINTMENT_TYPE_SERVICES.follow_up,
  APPOINTMENT_TYPE_SERVICES.other,
]);

/** A length snapped to the nearest chip (`updA`, H:5976): 35 → 30, 50 → 45. */
export function snapLength(minutes: number): number {
  return APPOINTMENT_LENGTHS.reduce(
    (best, step) => (Math.abs(step - minutes) < Math.abs(best - minutes) ? step : best),
    APPOINTMENT_LENGTHS[0],
  );
}

/** The booked person as the form holds them. */
function whoOf(person: AppointmentPerson): WhoDraft {
  return {
    kind: person.kind,
    contactId: person.contactId,
    name: person.name,
    phone: person.phone,
    patientId: person.patientId,
    leadId: person.leadId,
    contactNumber: person.contactNumber,
  };
}

/** A person the search found, as the form holds them — a patient, a lead or a contact. */
export function whoOfContact(contact: ContactSummary): WhoDraft {
  let kind: WhoDraft['kind'] = 'contact';
  if (contact.patientId) kind = 'patient';
  else if (contact.openLeadId) kind = 'lead';
  return {
    kind,
    contactId: contact.id,
    name: contact.name,
    phone: contact.primaryPhone,
    patientId: contact.patientId,
    leadId: contact.openLeadId,
    contactNumber: contact.contactNumber,
  };
}

/** An empty New form on a day: Consultation, 20 min (`openForm`, H:5895). */
export function emptyDraft(date: string | null): AppointmentDraft {
  return {
    who: null,
    newPhone: '',
    type: 'consultation',
    serviceLabel: APPOINTMENT_TYPE_SERVICES.consultation,
    offeringId: null,
    doctorId: null,
    durationMin: APPOINTMENT_TYPE_MINUTES.consultation,
    reason: '',
    notes: '',
    date,
    time: null,
    status: 'scheduled',
  };
}

/** A saved booking as the form edits it (Edit). */
export function draftOf(row: AppointmentRow): AppointmentDraft {
  return {
    who: whoOf(row.person),
    newPhone: '',
    type: row.type,
    serviceLabel: row.serviceLabel,
    offeringId: row.offeringId,
    doctorId: row.doctorId,
    durationMin: row.durationMin,
    reason: row.reason ?? '',
    notes: row.notes ?? '',
    date: row.date,
    time: row.startTime,
    status: row.status,
  };
}

/**
 * Reschedule: the booking's person, service, doctor and slot — its date, or
 * today when it has passed (H:5895).
 */
export function rescheduleDraftOf(row: AppointmentRow, today: string): AppointmentDraft {
  const draft = draftOf(row);
  return row.date < today ? { ...draft, date: today } : draft;
}

/**
 * Copy and Rebook (H:4147; Q-A6): a new booking with the same person,
 * service, doctor, length, reason and notes — today, no time.
 */
export function copyDraftOf(row: AppointmentRow, today: string): AppointmentDraft {
  return {
    ...draftOf(row),
    date: today,
    time: null,
    status: 'scheduled',
  };
}

/** The draft an Edit or a Reschedule opens with. */
export function savedDraftOf(
  row: AppointmentRow,
  mode: AppointmentFormMode,
  today: string,
): AppointmentDraft {
  return mode === 'reschedule' ? rescheduleDraftOf(row, today) : draftOf(row);
}

/**
 * The doctor a New form starts with — the first one known of: the prefill's,
 * the copied booking's, the first bookable one. A contact carries no usual
 * doctor and a branch no default one (api-integration §8 G5).
 */
export function startingDoctorId(
  candidates: readonly (string | null | undefined)[],
): string | null {
  return candidates.find((id): id is string => typeof id === 'string') ?? null;
}

/** What a New form loaded besides its prefill. */
export interface NewDraftContext {
  /** The person `whoId` names. */
  person: WhoDraft | undefined;
  /** The booking `copyOf` names. */
  source: AppointmentRow | undefined;
  today: string;
  doctorId: string | null;
}

/**
 * A New form's first draft: a Copy or Rebook from its booking (today, no
 * time, Q-A6); else the prefill's day — a past one starts today — person,
 * type, service, length, reason, the doctor, and the slot's time on that day.
 */
export function newDraftOf(
  prefill: AppointmentFormPrefill,
  { person, source, today, doctorId }: NewDraftContext,
): AppointmentDraft {
  if (source) return copyDraftOf(source, today);
  const date = prefill.date && prefill.date >= today ? prefill.date : today;
  let draft: AppointmentDraft = {
    ...emptyDraft(date),
    who: person ?? null,
    doctorId,
  };
  if (prefill.type)
    draft = applyAppointmentChange(draft, { kind: 'type', type: prefill.type });
  if (prefill.serviceLabel) draft = { ...draft, serviceLabel: prefill.serviceLabel };
  if (prefill.durationMin) {
    draft = applyAppointmentChange(draft, {
      kind: 'length',
      minutes: prefill.durationMin,
    });
  }
  if (prefill.reason) {
    draft = applyAppointmentChange(draft, { kind: 'reason', text: prefill.reason });
  }
  if (prefill.time && date === prefill.date) draft = { ...draft, time: prefill.time };
  return draft;
}

// ── Changes (`updA`, H:5976) ──

/** One control's change to the draft. */
export type AppointmentFormChange =
  | { kind: 'who'; who: WhoDraft | null }
  | { kind: 'newPhone'; digits: string }
  | { kind: 'type'; type: AppointmentType }
  | { kind: 'treatment'; label: string; offeringId: string | null; minutes: number }
  | { kind: 'doctor'; doctorId: string }
  | { kind: 'length'; minutes: number }
  | { kind: 'reason'; text: string }
  | { kind: 'notes'; text: string }
  | { kind: 'date'; date: string }
  | { kind: 'time'; time: string; saved: SavedSlot | null }
  | { kind: 'status'; status: AppointmentStatus }
  | { kind: 'reset'; draft: AppointmentDraft };

/** A type's own service and length (consultation, follow-up, other). */
function plainType(draft: AppointmentDraft, type: AppointmentType): AppointmentDraft {
  return {
    ...draft,
    type,
    serviceLabel: APPOINTMENT_TYPE_SERVICES[type],
    offeringId: null,
    durationMin: APPOINTMENT_TYPE_MINUTES[type],
  };
}

/**
 * Picking a type (`apTypeVals`, H:3893–3899): Treatment keeps a treatment
 * already picked, else "Treatment" 60; Package session keeps the length (the
 * package picker went with the backend, A12); the rest take their own service
 * and length.
 */
function changeType(draft: AppointmentDraft, type: AppointmentType): AppointmentDraft {
  if (type === 'treatment') {
    if (draft.type === 'treatment') return draft;
    if (!NON_TREATMENT_SERVICES.has(draft.serviceLabel)) return { ...draft, type };
    return {
      ...draft,
      type,
      serviceLabel: APPOINTMENT_TYPE_SERVICES.treatment,
      offeringId: null,
      durationMin: APPOINTMENT_TYPE_MINUTES.treatment,
    };
  }
  if (type === 'package_session') {
    return { ...plainType(draft, type), durationMin: draft.durationMin };
  }
  return plainType(draft, type);
}

/** A new doctor or day: the time clears (its slot was that doctor's, that day's); the same one keeps the draft. */
function changeSlotOwner(
  draft: AppointmentDraft,
  next: Pick<AppointmentDraft, 'doctorId'> | Pick<AppointmentDraft, 'date'>,
): AppointmentDraft {
  const same =
    'doctorId' in next ? next.doctorId === draft.doctorId : next.date === draft.date;
  return same ? draft : { ...draft, ...next, time: null };
}

/**
 * A new time in Edit (H:5976): moving a Scheduled or Confirmed booking returns
 * it to Scheduled; picking the saved slot again restores its status.
 */
function changeTime(
  draft: AppointmentDraft,
  time: string,
  saved: SavedSlot | null,
): AppointmentDraft {
  const next = { ...draft, time };
  if (!saved) return next;
  const moved = next.date !== saved.date || time !== saved.time;
  if (!moved) return { ...next, status: saved.status };
  if (saved.status === 'scheduled' || saved.status === 'confirmed') {
    return { ...next, status: 'scheduled' };
  }
  return next;
}

/**
 * The draft after one change — the prototype's `updA` (H:5976): a type sets
 * its length, a treatment or package its own (snapped to a chip), a new
 * doctor or day clears the time, and in Edit a move returns the booking to
 * Scheduled until the saved slot is picked again.
 */
export function applyAppointmentChange(
  draft: AppointmentDraft,
  change: AppointmentFormChange,
): AppointmentDraft {
  switch (change.kind) {
    case 'who':
      return { ...draft, who: change.who, newPhone: '' };
    case 'newPhone':
      return { ...draft, newPhone: change.digits.replace(/\D/g, '').slice(0, 10) };
    case 'type':
      return changeType(draft, change.type);
    case 'treatment':
      return {
        ...draft,
        type: 'treatment',
        serviceLabel: change.label,
        offeringId: change.offeringId,
        durationMin: snapLength(change.minutes),
      };
    case 'doctor':
      return changeSlotOwner(draft, { doctorId: change.doctorId });
    case 'length':
      return { ...draft, durationMin: snapLength(change.minutes) };
    case 'reason':
      return { ...draft, reason: change.text.slice(0, APPOINTMENT_FORM_LIMITS.reason) };
    case 'notes':
      return { ...draft, notes: change.text.slice(0, APPOINTMENT_FORM_LIMITS.notes) };
    case 'date':
      return changeSlotOwner(draft, { date: change.date });
    case 'time':
      return changeTime(draft, change.time, change.saved);
    case 'status':
      return { ...draft, status: change.status };
    case 'reset':
      return change.draft;
  }
}

// ── What the form derives ──

/** The draft's slot moved off the saved one (Edit, Reschedule). */
export function slotMoved(draft: AppointmentDraft, saved: SavedSlot | null): boolean {
  if (!saved || draft.date === null || draft.time === null) return false;
  return draft.date !== saved.date || draft.time !== saved.time;
}

/**
 * The Rescheduled note (Edit; H:4142): shown once a Scheduled or Confirmed
 * booking has a new slot — "needs confirming again" when it was Confirmed.
 */
export function rescheduleNote(
  draft: AppointmentDraft,
  saved: SavedSlot | null,
): { was: SavedSlot; confirmAgain: boolean } | null {
  if (!(saved && slotMoved(draft, saved))) return null;
  if (saved.status !== 'scheduled' && saved.status !== 'confirmed') return null;
  return { was: saved, confirmAgain: saved.status === 'confirmed' };
}

/** Comparable values of a draft — what "dirty" compares (Q-P1). */
function fingerprint(draft: AppointmentDraft) {
  return {
    who: draft.who
      ? `${draft.who.kind}:${draft.who.contactId}:${draft.who.patientId}:${draft.who.name}`
      : '',
    newPhone: draft.newPhone,
    type: draft.type,
    serviceLabel: draft.serviceLabel,
    offeringId: draft.offeringId,
    doctorId: draft.doctorId,
    durationMin: draft.durationMin,
    reason: draft.reason.trim(),
    notes: draft.notes.trim(),
    date: draft.date,
    time: draft.time,
    status: draft.status,
  };
}

/** Whether the draft differs from where it started. */
export function isDraftDirty(draft: AppointmentDraft, start: AppointmentDraft): boolean {
  const a = fingerprint(draft);
  const b = fingerprint(start);
  return (Object.keys(a) as (keyof typeof a)[]).some((key) => a[key] !== b[key]);
}

/**
 * The draft after the saved booking changed under it — a status written from
 * the form (Check in now, Cancel visit, Restore), a patient record linked:
 * every field the member has not touched takes the booking's new value, every
 * edit stays.
 */
export function rebaseDraft(
  draft: AppointmentDraft,
  previous: AppointmentDraft,
  next: AppointmentDraft,
): AppointmentDraft {
  const a = fingerprint(draft);
  const b = fingerprint(previous);
  const rebased = { ...draft };
  const take = <K extends keyof AppointmentDraft>(key: K) => {
    rebased[key] = next[key];
  };
  if (a.who === b.who) take('who');
  if (a.type === b.type && a.serviceLabel === b.serviceLabel) {
    take('type');
    take('serviceLabel');
    take('offeringId');
  }
  if (a.doctorId === b.doctorId) take('doctorId');
  if (a.durationMin === b.durationMin) take('durationMin');
  if (a.reason === b.reason) take('reason');
  if (a.notes === b.notes) take('notes');
  if (a.date === b.date && a.time === b.time) {
    take('date');
    take('time');
  }
  if (a.status === b.status) take('status');
  return rebased;
}

/** Step 1 is done once service, doctor and length are set (circle green). */
export function detailsDone(draft: AppointmentDraft): boolean {
  return Boolean(draft.serviceLabel.trim() && draft.doctorId && draft.durationMin);
}

/** Step 2 is done once a date and a time are set. */
export function slotDone(draft: AppointmentDraft): boolean {
  return draft.date !== null && draft.time !== null;
}

/** Date & time are locked once the patient is checked in (`S:352`). */
const slotLocked = (status: AppointmentStatus) => isAppointmentSlotLocked(status);

/** What the primary button says (H:5983): "Pick a time" · "Book …" · "Move to …" · "Save changes". */
export type SaveLabelKind = 'pickTime' | 'book' | 'move' | 'saveChanges';

/** Which primary label applies (`saveLabel`). */
export function saveLabelKind(
  mode: AppointmentFormMode,
  draft: AppointmentDraft,
  saved: SavedSlot | null,
): SaveLabelKind {
  if (draft.date === null || draft.time === null) return 'pickTime';
  if (mode === 'create') return 'book';
  if (mode === 'reschedule') return 'move';
  return slotMoved(draft, saved) ? 'move' : 'saveChanges';
}

/** Who, date and time are all set — the primary sits at 50% until then (still clickable). */
export function draftComplete(draft: AppointmentDraft): boolean {
  return draft.who !== null && slotDone(draft);
}

// ── The person's lead (`lead_id`, A1) ──

/**
 * " · moves to Clinic visited at check-in" — while the person has an open lead
 * and the visit is not checked in (H:4139); the server moves it (A1).
 */
export function movesAtCheckIn(
  leadId: string | null,
  status: AppointmentStatus,
): boolean {
  return leadId !== null && !slotLocked(status);
}

// ── The slot grid (H:6001–6002) ──

/** Where the day's slot read stands: `ready` has the day; the rest say why there is none. */
export type AppointmentSlotsStatus = 'idle' | 'loading' | 'error' | 'ready';

/** One hour row of the slot grid. */
export interface SlotHour {
  /** 0–23. */
  hour: number;
  /** Its free starts — the server lists free starts only (G3). */
  slots: AppointmentSlot[];
}

/** The free starts by hour, in order — one row per hour that has one. */
export function slotHours(slots: readonly AppointmentSlot[]): SlotHour[] {
  const hours: SlotHour[] = [];
  for (const slot of slots) {
    const hour = Math.floor(clockMinutes(slot.time) / 60);
    let row = hours.at(-1);
    if (row?.hour !== hour) {
      row = { hour, slots: [] };
      hours.push(row);
    }
    row.slots.push(slot);
  }
  return hours;
}

/** The hour rows in columns — two above six hours, the first holding the extra one. */
export function slotColumns(hours: readonly SlotHour[]): SlotHour[][] {
  if (hours.length <= 6) return [[...hours]];
  const half = Math.ceil(hours.length / 2);
  return [hours.slice(0, half), hours.slice(half)];
}

/** A 24-hour hour as the grid labels it: the 12-hour number and its half of the day. */
export function hourLabel(hour: number): { number: number; period: 'am' | 'pm' } {
  return { number: hour % 12 || 12, period: hour < 12 ? 'am' : 'pm' };
}

// ── What a save sends ──

/** A new contact's mobile as the contract stores it, or `null` when it is not ten digits. */
export function newContactPhone(draft: AppointmentDraft): string | null {
  return draft.newPhone.length === 10 ? toAppPhone(draft.newPhone) : null;
}

/** The fields a booking shares between New and Edit. */
function bookingFields(draft: AppointmentDraft) {
  return {
    type: draft.type,
    serviceLabel: draft.serviceLabel.trim(),
    offeringId: draft.offeringId,
    durationMin: draft.durationMin,
    reason: draft.reason.trim() || null,
    notes: draft.notes.trim() || null,
  };
}

/**
 * A new booking (`POST /app/appointments`) from a complete draft for a contact —
 * the caller has checked who, the slot and the doctor first, and created a new
 * person's contact.
 */
export function createInputOf(
  draft: AppointmentDraft,
  context: { branchId: string; contactId: string },
): AppointmentCreateInput {
  return {
    ...bookingFields(draft),
    contactId: context.contactId,
    branchId: context.branchId,
    doctorId: draft.doctorId ?? '',
    date: draft.date ?? '',
    startTime: draft.time ?? '',
  };
}

/**
 * Whether a Copy can go as `POST …/copy` — the booking it starts from booked again on another
 * slot: the same doctor, branch, service, length and reason, and no notes (the copy carries
 * none). Anything else changed is a new booking for the same person.
 */
export function copiesAsIs(
  draft: AppointmentDraft,
  source: AppointmentRow,
  branchId: string,
): boolean {
  const fields = bookingFields(draft);
  return (
    draft.doctorId === source.doctorId &&
    branchId === source.branchId &&
    fields.type === source.type &&
    fields.serviceLabel === source.serviceLabel &&
    fields.offeringId === source.offeringId &&
    fields.durationMin === source.durationMin &&
    fields.reason === source.reason &&
    fields.notes === null
  );
}

/** The booking fields an edit compares with the saved booking. */
const BOOKING_KEYS = [
  'type',
  'serviceLabel',
  'offeringId',
  'durationMin',
  'reason',
  'notes',
] as const;

/**
 * An edit (`PATCH /app/appointments/:appointment_id`): the fields that changed —
 * a new doctor, date or start moves the booking (a moved Confirmed one is
 * Scheduled again, the server's rule). The status is not a field: see
 * {@link moveRouteOf}.
 */
export function patchOf(
  draft: AppointmentDraft,
  row: AppointmentRow,
): Partial<AppointmentFields> {
  const fields = bookingFields(draft);
  const patch: Partial<AppointmentFields> = {};
  for (const key of BOOKING_KEYS) {
    if (fields[key] !== row[key]) Object.assign(patch, { [key]: fields[key] });
  }
  if (draft.doctorId && draft.doctorId !== row.doctorId) patch.doctorId = draft.doctorId;
  if (draft.date && draft.date !== row.date) patch.date = draft.date;
  if (draft.time && draft.time !== row.startTime) patch.startTime = draft.time;
  return patch;
}

/**
 * The move a status tile asks for over the saved status — one route each (`POST …/confirm`,
 * `/check-in`, `/complete`); none when the tiles stayed, or when a move of the slot set it
 * back to Scheduled (the server does that itself).
 */
export function moveRouteOf(
  draft: AppointmentDraft,
  row: AppointmentRow,
): AppointmentMoveRoute | null {
  if (draft.status === row.status) return null;
  if (draft.status === 'confirmed' && row.status === 'scheduled') return 'confirm';
  if (draft.status === 'checked_in') return 'check-in';
  if (draft.status === 'completed' && row.status === 'checked_in') return 'complete';
  return null;
}
