import type { AppointmentStatus, CancelReason } from './clinic-schema.ts';
import { clinicClockTime, clinicToday } from './clinic-time.ts';

/*
 * The appointment status machine (KICKOFF §6.4; `S:1137–1145`, H:3422,
 * H:5899–5900, H:5974, H:6038): ONE transition table and ONE guard set for the
 * Change status popover, the appointment card, the form's status tiles, the
 * cancel view and Today (Q-A7) — the prototype's card skipped the popover's
 * guards and its form let Completed step back (§7.3). Pure: the fixture server
 * answers with these same rules, so no screen offers a move the server refuses.
 * Guards return reason codes; each screen words them (`appointment-status.constants.ts`).
 */

// ── The transition table ──

/**
 * A move the popover offers: a status, or "Move to another time" — the
 * Reschedule mode, not a status (it returns the booking to Scheduled with
 * `rescheduledFrom`, `S:344`).
 */
export type AppointmentMove = Exclude<AppointmentStatus, 'scheduled'> | 'reschedule';

/** From each status, the moves in the popover's order (`AP_FLOW`, H:3422). */
export const APPOINTMENT_FLOW: Readonly<
  Record<AppointmentStatus, readonly AppointmentMove[]>
> = {
  scheduled: ['confirmed', 'checked_in', 'reschedule', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'reschedule', 'cancelled', 'no_show'],
  checked_in: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** The statuses nothing moves out of — "Final status. Use Rebook to make a new appointment." */
export const FINAL_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'completed',
  'cancelled',
  'no_show',
];

/** Whether a status is final (Completed, Cancelled, No show). */
export function isFinalAppointmentStatus(status: AppointmentStatus): boolean {
  return FINAL_APPOINTMENT_STATUSES.includes(status);
}

/** Whether the date and time are locked — once the patient is checked in (`S:352`). */
export function isAppointmentSlotLocked(status: AppointmentStatus): boolean {
  return status === 'checked_in' || status === 'completed';
}

/** The moves out of a status, in the popover's order (`allowedNext`). */
export function allowedNext(status: AppointmentStatus): readonly AppointmentMove[] {
  return APPOINTMENT_FLOW[status];
}

// ── Guards ──

/** What the guards read of a booking. */
export interface AppointmentGuardSubject {
  status: AppointmentStatus;
  /** The visit day, clinic-local `YYYY-MM-DD`. */
  date: string;
  /** The start, clinic-local `HH:mm`. */
  startTime: string;
  /** The person has a patient record — Completed needs one. */
  isPatient: boolean;
}

/**
 * Why a move is not offered: no Edit (Q-A16) · a final status · not a move out
 * of this status · Checked in off the visit day ("Only on <day>") · No show
 * before the start ("Available after <time> on <day>") · Completed for a lead
 * or contact (a patient record first).
 */
export type AppointmentGuardReason =
  'no_access' | 'final' | 'not_allowed' | 'visit_day' | 'before_start' | 'needs_patient';

/** A guard's verdict. */
export type AppointmentGuard =
  { allowed: true } | { allowed: false; reason: AppointmentGuardReason };

const ALLOWED: AppointmentGuard = { allowed: true };
const blocked = (reason: AppointmentGuardReason): AppointmentGuard => ({
  allowed: false,
  reason,
});

/** The clock a guard reads, and whether the member may change bookings at all. */
export interface AppointmentGuardOptions {
  now: Date;
  /** The member's Edit on Appointments (Q-A16); the server checks its own. Default true. */
  canEdit?: boolean;
}

/** Whether the booking's start has come (minute precision, clinic clock). */
export function hasAppointmentStarted(
  subject: Pick<AppointmentGuardSubject, 'date' | 'startTime'>,
  now: Date,
): boolean {
  const today = clinicToday(now);
  if (subject.date !== today) return subject.date < today;
  return subject.startTime <= clinicClockTime(now);
}

/**
 * Whether a move may run now (`transitionGuard`): Checked in only on the visit
 * day; No show only after the start; Completed only for a patient; nothing out
 * of a final status; nothing without Edit.
 */
export function transitionGuard(
  subject: AppointmentGuardSubject,
  move: AppointmentMove,
  { now, canEdit = true }: AppointmentGuardOptions,
): AppointmentGuard {
  if (!canEdit) return blocked('no_access');
  if (isFinalAppointmentStatus(subject.status)) return blocked('final');
  if (!APPOINTMENT_FLOW[subject.status].includes(move)) return blocked('not_allowed');
  if (move === 'checked_in' && subject.date !== clinicToday(now)) {
    return blocked('visit_day');
  }
  if (move === 'no_show' && !hasAppointmentStarted(subject, now)) {
    return blocked('before_start');
  }
  if (move === 'completed' && !subject.isPatient) return blocked('needs_patient');
  return ALLOWED;
}

/** One popover option: the move and whether it is offered now (disabled at 45% otherwise). */
export interface AppointmentMoveOption {
  move: AppointmentMove;
  guard: AppointmentGuard;
}

/** The popover's options for a booking — every move out of its status, each with its guard. */
export function appointmentMoveOptions(
  subject: AppointmentGuardSubject,
  options: AppointmentGuardOptions,
): AppointmentMoveOption[] {
  return allowedNext(subject.status).map((move) => ({
    move,
    guard: transitionGuard(subject, move, options),
  }));
}

/** Why Restore is not offered: no Edit · not cancelled · the start has passed. */
export type AppointmentRestoreReason = 'no_access' | 'not_cancelled' | 'time_passed';

/**
 * Whether a cancelled booking can come back (`restoreAppointment`, `S:1612`;
 * Restore → Scheduled, Appendix F): "You can restore it until the time passes."
 */
export function restoreGuard(
  subject: Pick<AppointmentGuardSubject, 'status' | 'date' | 'startTime'>,
  { now, canEdit = true }: AppointmentGuardOptions,
): { allowed: true } | { allowed: false; reason: AppointmentRestoreReason } {
  if (!canEdit) return { allowed: false, reason: 'no_access' };
  if (subject.status !== 'cancelled') return { allowed: false, reason: 'not_cancelled' };
  if (hasAppointmentStarted(subject, now))
    return { allowed: false, reason: 'time_passed' };
  return { allowed: true };
}

// ── The card's next step ──

/** The card's primary next step (H:5900; Rebook is a new booking via `copyOf`, Q-A6). */
export const APPOINTMENT_NEXT_ACTIONS = [
  'check_in',
  'confirm',
  'complete',
  'rebook',
] as const;
/** One next step. */
export type AppointmentNextAction = (typeof APPOINTMENT_NEXT_ACTIONS)[number];

/** The move each next step makes — Rebook makes none: the No-show stays final. */
export const NEXT_ACTION_MOVES: Readonly<
  Record<AppointmentNextAction, AppointmentMove | null>
> = {
  check_in: 'checked_in',
  confirm: 'confirmed',
  complete: 'completed',
  rebook: null,
};

/**
 * The next step (`nextAction`): Check in on the visit day (Scheduled or
 * Confirmed) · Confirm (Scheduled) · Complete (Checked in) · Rebook (No show)
 * · none. The card runs it through {@link transitionGuard} like any move.
 */
export function nextAction(
  subject: Pick<AppointmentGuardSubject, 'status' | 'date'>,
  today: string,
): AppointmentNextAction | null {
  const { status } = subject;
  if ((status === 'scheduled' || status === 'confirmed') && subject.date === today) {
    return 'check_in';
  }
  if (status === 'scheduled') return 'confirm';
  if (status === 'checked_in') return 'complete';
  if (status === 'no_show') return 'rebook';
  return null;
}

// ── The form's status tiles ──

/** The form's four tiles, in order (H:6038). */
export const APPOINTMENT_TILE_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
] as const satisfies readonly AppointmentStatus[];
/** One tile. */
export type AppointmentTileStatus = (typeof APPOINTMENT_TILE_STATUSES)[number];

/**
 * Why a tile can't be picked — the tile's own tooltip ("Booked", "They said
 * yes", "Available on the visit day", "After check-in"), or: a patient record
 * first (the tile still toasts), Completed is final once saved, a closed
 * booking (Cancelled, No show), no Edit.
 */
export type AppointmentTileReason =
  | 'booked'
  | 'said_yes'
  | 'visit_day'
  | 'after_check_in'
  | 'needs_patient'
  | 'final'
  | 'closed'
  | 'no_access';

/** One status tile: its place in the tracker and whether it can be picked. */
export interface AppointmentTile {
  status: AppointmentTileStatus;
  /** Before the picked status (✓ on the tint), the picked one (solid), or after it (ring). */
  step: 'done' | 'current' | 'upcoming';
  pickable: boolean;
  reason: AppointmentTileReason | null;
}

/** What the tiles read: the saved booking, the form's draft and the clock. */
export interface AppointmentTilesInput {
  saved: AppointmentStatus;
  /** The status the form shows — the saved one until a tile is picked. */
  draft: AppointmentStatus;
  /** The draft's visit day. */
  date: string;
  today: string;
  isPatient: boolean;
  canEdit: boolean;
}

/** The tooltip each tile carries when it is not on offer. */
const TILE_REASONS: Readonly<Record<AppointmentTileStatus, AppointmentTileReason>> = {
  scheduled: 'booked',
  confirmed: 'said_yes',
  checked_in: 'visit_day',
  completed: 'after_check_in',
};

function tilesOnOffer(draft: AppointmentStatus, date: string, today: string) {
  if (draft === 'checked_in' || draft === 'completed') return ['checked_in', 'completed'];
  return date === today
    ? ['scheduled', 'confirmed', 'checked_in']
    : ['scheduled', 'confirmed'];
}

/**
 * The form's tiles (`formTiles`, H:6038): on the visit day Scheduled ·
 * Confirmed · Checked in; on other days Scheduled · Confirmed; after check-in
 * Checked in · Completed — Completed for patients only. Completed is final once
 * saved (the prototype let it step back, §7.3); Cancelled and No show leave
 * every tile inert.
 */
export function formTiles(input: AppointmentTilesInput): AppointmentTile[] {
  const closed = input.saved === 'cancelled' || input.saved === 'no_show';
  const position = closed
    ? -1
    : APPOINTMENT_TILE_STATUSES.indexOf(input.draft as AppointmentTileStatus);
  const onOffer: readonly string[] = tilesOnOffer(input.draft, input.date, input.today);
  const reasonFor = (status: AppointmentTileStatus): AppointmentTileReason | null => {
    if (closed) return 'closed';
    if (input.saved === 'completed') return 'final';
    if (!input.canEdit) return 'no_access';
    if (!onOffer.includes(status)) return TILE_REASONS[status];
    if (status === 'completed' && !input.isPatient) return 'needs_patient';
    return null;
  };
  return APPOINTMENT_TILE_STATUSES.map((status, index) => {
    const reason = reasonFor(status);
    let step: AppointmentTile['step'] = 'upcoming';
    if (index < position) step = 'done';
    else if (index === position) step = 'current';
    return { status, step, pickable: reason === null, reason };
  });
}

/**
 * The hint line under the tiles (`appointments.md:376`): the draft's own, a
 * lead or contact after check-in ("Create the patient record to complete this
 * visit"), a cancelled booking's ("Restore to bring it back …"), or a No-show's
 * "This appointment is closed · No show" — not the Scheduled hint the
 * prototype showed (H:6040, §7.3).
 */
export type AppointmentStatusHint =
  AppointmentTileStatus | 'needs_patient' | 'cancelled' | 'closed';

const closedHint = (status: 'cancelled' | 'no_show'): AppointmentStatusHint =>
  status === 'cancelled' ? 'cancelled' : 'closed';

/** Which hint the form shows. */
export function formStatusHint(
  input: Pick<AppointmentTilesInput, 'saved' | 'draft' | 'isPatient'>,
): AppointmentStatusHint {
  if (input.saved === 'cancelled' || input.saved === 'no_show') {
    return closedHint(input.saved);
  }
  const { draft } = input;
  if (draft === 'cancelled' || draft === 'no_show') return closedHint(draft);
  if ((draft === 'checked_in' || draft === 'completed') && !input.isPatient) {
    return 'needs_patient';
  }
  return draft;
}

/**
 * Whether a form save may set `next` over the saved status (`updateAppointment`
 * with a status, `S:1610`): un-confirm and confirm freely before check-in;
 * check in on the visit day; complete after check-in — or straight from the
 * visit day's Scheduled or Confirmed, both stamps at once — patients only.
 * Cancel and No show have their own writes; a final status takes none.
 */
export function formStatusGuard(
  saved: AppointmentStatus,
  next: AppointmentStatus,
  context: { date: string; today: string; isPatient: boolean },
): AppointmentGuard {
  if (next === saved) return ALLOWED;
  if (isFinalAppointmentStatus(saved)) return blocked('final');
  if (next === 'cancelled' || next === 'no_show') return blocked('not_allowed');
  const beforeArrival = saved === 'scheduled' || saved === 'confirmed';
  if (next === 'scheduled' || next === 'confirmed') {
    return beforeArrival ? ALLOWED : blocked('not_allowed');
  }
  const onVisitDay = context.date === context.today;
  if (next === 'checked_in') return onVisitDay ? ALLOWED : blocked('visit_day');
  if (beforeArrival && !onVisitDay) return blocked('visit_day');
  return context.isPatient ? ALLOWED : blocked('needs_patient');
}

// ── Cancel reasons ──

/** The cancel view's two groups (H:3421): PATIENT and CLINIC. */
export const CANCEL_REASON_SIDES = ['patient', 'clinic'] as const;
/** One side. */
export type CancelReasonSide = (typeof CANCEL_REASON_SIDES)[number];

/** The popover's cancel reasons — exactly the contract's `cancel_reason` (`S:1147–1154`, D32), by side. */
export const CANCEL_REASON_GROUPS: readonly {
  side: CancelReasonSide;
  reasons: readonly CancelReason[];
}[] = [
  { side: 'patient', reasons: ['patient_asked', 'unreachable'] },
  { side: 'clinic', reasons: ['doctor_unavailable', 'resource_unavailable', 'other'] },
];

/** The form's Cancel visit reasons (`appointments.md:225`). */
export const APPOINTMENT_FORM_CANCEL_REASONS = [
  'patient_cancelled',
  'rescheduling_later',
  'doctor_unavailable',
  'booked_by_mistake',
  'other',
] as const;
/** One of the form's cancel reasons. */
export type AppointmentFormCancelReason =
  (typeof APPOINTMENT_FORM_CANCEL_REASONS)[number];

/**
 * How a form reason is stored (D32, AMBER A-A3; `cancelReasonToContract`):
 * Patient cancelled → `patient_asked`; Doctor unavailable →
 * `doctor_unavailable`; Rescheduling later and Booked by mistake → `other` with
 * their label as the note; Other → `other` with the member's note.
 *
 * @param label The reason's label as the member read it (the note for the two `other` mappings).
 */
export function cancelReasonToContract(
  reason: AppointmentFormCancelReason,
  { note, label }: { note: string | null; label: string },
): { reason: CancelReason; note: string | null } {
  switch (reason) {
    case 'patient_cancelled':
      return { reason: 'patient_asked', note: null };
    case 'doctor_unavailable':
      return { reason: 'doctor_unavailable', note: null };
    case 'rescheduling_later':
    case 'booked_by_mistake':
      return { reason: 'other', note: label };
    case 'other':
      return { reason: 'other', note: note?.trim() || null };
  }
}

// ── Effects ──

/**
 * What a status brings with it (KICKOFF §6.4 "Side effects"; Q-T3): the
 * record effects the server writes with the status, and the tasks its rule
 * job raises — a fixture job now, inside the same write so Undo takes them
 * back too.
 *
 * - `confirmRequest` — the WhatsApp confirm request goes out (new, moved or restored).
 * - `confirmTask` — "Confirm visits" (`confirm_visit`, `S:1506`) when it comes close.
 * - `reminderQueued` — the reminder goes out ("· reminder queued").
 * - `checkInStamp` / `completeStamp` — `checkedInAt` / `completedAt`.
 * - `leadsVisited` — every open lead of the person → Clinic visited, plus a system line (`S:1610`, H:6047).
 * - `feedbackTask` — "Collect feedback" the day after (H:5899).
 * - `releaseSlot` / `stopReminders` — the slot frees and reminders stop.
 * - `noShowTask` — "Rebook no-shows" (outcomes Rebooked · Not interested · No answer).
 */
export type AppointmentEffect =
  | 'confirmRequest'
  | 'confirmTask'
  | 'reminderQueued'
  | 'checkInStamp'
  | 'completeStamp'
  | 'leadsVisited'
  | 'feedbackTask'
  | 'releaseSlot'
  | 'stopReminders'
  | 'noShowTask';

/** The effects of arriving at each status. */
export const APPOINTMENT_STATUS_EFFECTS: Readonly<
  Record<AppointmentStatus, readonly AppointmentEffect[]>
> = {
  scheduled: ['confirmRequest', 'confirmTask'],
  confirmed: ['reminderQueued'],
  checked_in: ['checkInStamp', 'leadsVisited'],
  completed: ['completeStamp', 'leadsVisited', 'feedbackTask'],
  cancelled: ['releaseSlot', 'stopReminders'],
  no_show: ['noShowTask'],
};
