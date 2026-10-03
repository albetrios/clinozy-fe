import {
  type AppointmentGuardReason,
  type AppointmentRestoreReason,
  formStatusGuard,
  isAppointmentSlotLocked,
  restoreGuard,
  transitionGuard,
} from '@/shared/api/clinic/appointment-status.ts';
import {
  APPOINTMENT_RANGE_MAX_DAYS,
  APPOINTMENT_TYPE_MINUTES,
  type AppointmentCancelInput,
  appointmentCancelInputSchema,
  type AppointmentChange,
  type AppointmentCreateInput,
  type AppointmentDaySummary,
  type AppointmentFields,
  appointmentInputSchema,
  appointmentListParamsSchema,
  type AppointmentPatch,
  type AppointmentPerson,
  appointmentRangeParamsSchema,
  type AppointmentRecord,
  type AppointmentRow,
  type AppointmentSlot,
  type AppointmentSortKey,
  type AppointmentStaff,
  type AppointmentStatusInput,
  appointmentStatusInputSchema,
  type AppointmentUpdate,
  availableSlotsParamsSchema,
  statusesForFilter,
} from '@/shared/api/clinic/appointments-contracts.ts';
import {
  createdFilterMatches,
  followUpFilterMatches,
} from '@/shared/api/clinic/clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  definedFields,
  type FixtureChange,
  recordFixtureChange,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import {
  APPOINTMENT_STATUS_VALUES,
  type AppointmentStatus,
  appointmentStatusSchema,
  type AppointmentType,
  type Branch,
  type OfferingSuggestion,
  type Patient,
  type User,
  WEEKDAY_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  civilDayOffset,
  clinicClockTime,
  clinicInstant,
  clinicToday,
  clockMinutes,
  clockOfMinutes,
} from '@/shared/api/clinic/clinic-time.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { ListPage } from '@/shared/api/fetch-list-page.ts';

import { writeAppointmentStatus } from './appointment-status.fixtures.ts';
import { branchRef, MAIN_BRANCH } from './organization.fixtures.ts';
import { clockLabel, dayLabel } from './task-rules.fixtures.ts';
import { syncTaskRules } from './tasks-server.fixtures.ts';
import { clinicFixtures, onClinicFixturesReset } from './world.fixtures.ts';

/**
 * The Appointments fixture server (REPLACE_WITH_API: `listAppointments`,
 * `listAppointmentsRange`, `getAppointment`, `availableSlots`,
 * `createAppointment`, `updateAppointment`, `setAppointmentStatus`,
 * `cancelAppointment`, `restoreAppointment` — `S:1582, 1600–1612` — plus
 * Appendix F's per-day summary, bookable staff and Undo). It answers the way
 * clinozy-be will: 422 for a broken field, 409 for a refused move or a taken
 * slot, 404 for an unknown booking. Every write runs the task rule job inside
 * its own change, so a status's tasks come and go with it. `appointments-api.ts`
 * loads this module on demand; when the API lands, it goes.
 */

const undoLog = new Map<string, FixtureChange>();
onClinicFixturesReset(() => undoLog.clear());

/** The prototype's status names, for the server's English refusals. */
const STATUS_TEXT: Readonly<Record<AppointmentStatus, string>> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

/** A booking's service when neither an offering nor a label names one: its type (`AP_TYPE`, H:3418). */
const TYPE_SERVICE: Readonly<Record<AppointmentType, string>> = {
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  treatment: 'Treatment',
  package_session: 'Package session',
  other: 'Other',
};

const SLOT_TAKEN = 'Just taken · pick another slot';
const SLOT_PASSED = 'That time has passed · pick a future slot';
const SLOT_LOCKED = 'Date & time are locked once the patient is checked in';
const OUTSIDE_HOURS = 'Pick a time inside clinic hours';
const NEEDS_PATIENT = 'Create the patient record first · Completed needs a patient';
const FINAL = 'Final status. Use Rebook to make a new appointment.';

// ── Rows ──

interface Lookups {
  patients: ReadonlyMap<string, Patient>;
  leads: ReadonlyMap<string, LeadRecord>;
  staff: ReadonlyMap<string, User>;
  suggestions: readonly OfferingSuggestion[];
}

const byId = <T extends { id: string }>(rows: readonly T[]) =>
  new Map(rows.map((row) => [row.id, row]));

function lookups(): Lookups {
  return {
    patients: byId(clinicFixtures.patients.snapshot()),
    leads: byId(clinicFixtures.leads.snapshot()),
    staff: byId(clinicFixtures.staff.snapshot()),
    suggestions: clinicFixtures.offeringSuggestions.snapshot(),
  };
}

const fullName = (patient: Pick<Patient, 'firstName' | 'lastName'>) =>
  [patient.firstName, patient.lastName].filter(Boolean).join(' ');

function patientPerson(patient: Patient, leadId: string | null): AppointmentPerson {
  return {
    kind: 'patient',
    name: fullName(patient),
    phone: patient.phone,
    patientId: patient.id,
    leadId,
    seq: patient.seq,
  };
}

/**
 * The booked person: the patient (directly, or through a lead that became
 * one), else the lead — a contact when it is a contact thread (D32).
 */
function personOf(visit: AppointmentRecord, view: Lookups): AppointmentPerson {
  const patient = visit.patientId ? view.patients.get(visit.patientId) : undefined;
  if (patient) return patientPerson(patient, visit.leadId);
  const lead = visit.leadId ? view.leads.get(visit.leadId) : undefined;
  const converted = lead?.patientId ? view.patients.get(lead.patientId) : undefined;
  if (lead && converted) return patientPerson(converted, lead.id);
  if (lead) {
    return {
      kind: lead.isContactThread ? 'contact' : 'lead',
      name: lead.name,
      phone: lead.phone,
      patientId: null,
      leadId: lead.id,
      seq: lead.isContactThread ? null : lead.seq,
    };
  }
  return {
    kind: 'contact',
    name: '',
    phone: null,
    patientId: null,
    leadId: null,
    seq: null,
  };
}

function staffOf(user: User): AppointmentStaff {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    initials: user.initials,
    tone: user.tone,
    roles: user.roles,
    presence: user.presence,
    active: user.active,
  };
}

function rowOf(visit: AppointmentRecord, view: Lookups): AppointmentRow {
  const doctor = view.staff.get(visit.doctorId);
  return {
    ...visit,
    person: personOf(visit, view),
    doctor: doctor ? staffOf(doctor) : null,
    plan: {
      visit: view.suggestions.filter((row) => row.appointmentId === visit.id).length,
      patient: visit.patientId
        ? view.suggestions.filter((row) => row.patientId === visit.patientId).length
        : 0,
    },
  };
}

// ── Filters and order ──

/** Name, mobile and "#seq" with spaces and "#" ignored (Q-A12; H:5899 `qq`). */
function matchesSearch(row: AppointmentRow, query: string | undefined): boolean {
  const needle = (query ?? '').toLowerCase().replace(/[\s#]/g, '');
  if (!needle) return true;
  return `${row.person.name}${row.person.phone ?? ''}${row.seq}`
    .toLowerCase()
    .replace(/\s/g, '')
    .includes(needle);
}

type SharedFilters = Pick<
  ReturnType<typeof appointmentListParamsSchema.parse>,
  'status' | 'doctorIds' | 'created' | 'followUp' | 'q' | 'branchIds'
>;

/** The filters every read shares — Created and Follow-up apply to the calendars too (§7.3). */
function inFilters(row: AppointmentRow, filters: SharedFilters, today: string): boolean {
  return (
    statusesForFilter(filters.status).includes(row.status) &&
    (filters.doctorIds.length === 0 || filters.doctorIds.includes(row.doctorId)) &&
    (filters.branchIds.length === 0 || filters.branchIds.includes(row.branchId)) &&
    (filters.created === undefined ||
      createdFilterMatches(row.createdAt, filters.created, today)) &&
    (filters.followUp === undefined ||
      followUpFilterMatches(row.followUpAt, filters.followUp, today)) &&
    matchesSearch(row, filters.q)
  );
}

/** By day and time, then the booking number — the calendars' order. */
const bySlot = (a: AppointmentRecord, b: AppointmentRecord) =>
  compareText(a.date, b.date) || compareText(a.startTime, b.startTime) || a.seq - b.seq;

const SORT_KEYS: Readonly<
  Record<AppointmentSortKey, (a: AppointmentRow, b: AppointmentRow) => number>
> = {
  contact: (a, b) => a.person.name.localeCompare(b.person.name),
  service: (a, b) => a.serviceLabel.localeCompare(b.serviceLabel),
  // Scheduled → Confirmed → Checked in → Completed → Cancelled → No show.
  status: (a, b) =>
    APPOINTMENT_STATUS_VALUES.indexOf(a.status) -
    APPOINTMENT_STATUS_VALUES.indexOf(b.status),
};

/** The Agenda's order: by day, the sort inside each day (ascending unless said), then the time. */
function agendaOrder(
  sort: AppointmentSortKey | undefined,
  order: 'asc' | 'desc' | undefined,
) {
  return (a: AppointmentRow, b: AppointmentRow) => {
    const day = compareText(a.date, b.date);
    if (day !== 0 || !sort) return day || bySlot(a, b);
    const direction = order === 'desc' ? -1 : 1;
    return direction * SORT_KEYS[sort](a, b) || bySlot(a, b);
  };
}

function liveRows(view: Lookups): Map<string, AppointmentRow> {
  return new Map(
    clinicFixtures.appointments.snapshot().map((visit) => [visit.id, rowOf(visit, view)]),
  );
}

/** The Agenda's rows, in order: one day, or from today on (no past paging, AMBER A-A1). */
function agendaRows(raw: unknown, now: Date): AppointmentRow[] {
  const params = validateClinicInput(appointmentListParamsSchema, raw);
  const today = clinicToday(now);
  return [...liveRows(lookups()).values()]
    .filter(
      (row) =>
        (params.date ? row.date === params.date : row.date >= today) &&
        inFilters(row, params, today),
    )
    .sort(agendaOrder(params.sort, params.order));
}

// ── Reads ──

/** One Agenda page (`listAppointments`, `S:1603`): 50 rows, by day, sorted inside each day. */
export async function listAppointments(
  raw: unknown,
  after?: string,
): Promise<ListPage<AppointmentRow>> {
  const sorted = agendaRows(raw, new Date());
  const order = new Map(sorted.map((row, index) => [row.id, index]));
  const page = await clinicFixtures.appointments.list({
    where: (visit) => order.has(visit.id),
    sort: (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    cursor: after ?? null,
  });
  const rows = page.items.flatMap((visit) => {
    const row = sorted[order.get(visit.id) ?? -1];
    return row ? [row] : [];
  });
  return { rows, next: page.nextCursor, hasMore: page.nextCursor !== null };
}

/**
 * The Agenda's per-day counts (Appendix F): a day group's header reads its
 * day here, whatever page its rows arrived on.
 */
export async function listAppointmentDaySummaries(
  raw: unknown,
): Promise<AppointmentDaySummary[]> {
  const days = new Map<string, AppointmentDaySummary>();
  for (const row of agendaRows(raw, new Date())) {
    const day = days.get(row.date) ?? {
      date: row.date,
      total: 0,
      confirmed: 0,
      scheduled: 0,
    };
    day.total += 1;
    if (row.status === 'confirmed') day.confirmed += 1;
    if (row.status === 'scheduled') day.scheduled += 1;
    days.set(row.date, day);
  }
  return [...days.values()];
}

/** The calendars' read (`listAppointmentsRange`, `S:1602`): every booking in the range, no paging. */
export async function listAppointmentsRange(raw: unknown): Promise<AppointmentRow[]> {
  const params = validateClinicInput(appointmentRangeParamsSchema, raw);
  if (civilDayOffset(params.from, params.to) >= APPOINTMENT_RANGE_MAX_DAYS) {
    const message = `Pick a range of up to ${APPOINTMENT_RANGE_MAX_DAYS} days`;
    throw clinicHttpError(422, 'validation', message, { to: [message] });
  }
  const today = clinicToday(new Date());
  return [...liveRows(lookups()).values()]
    .filter(
      (row) =>
        row.date >= params.from && row.date <= params.to && inFilters(row, params, today),
    )
    .sort(bySlot);
}

/** One booking (`getAppointment`, `S:1604`) — 404 when it is unknown, deleted or not an id at all. */
export async function getAppointment(id: string): Promise<AppointmentRow> {
  return rowOf(await clinicFixtures.appointments.get(id), lookups());
}

const isBookable = (user: User) =>
  user.active && user.roles.some((role) => role === 'doctor' || role === 'therapist');

/**
 * Who can be booked — the doctors and therapists on the team (Users), doctors
 * first (REPLACE_WITH_API: `listUsers` by role).
 */
export async function listBookableStaff(): Promise<AppointmentStaff[]> {
  const isDoctor = (user: User) => user.roles.includes('doctor');
  return clinicFixtures.staff
    .snapshot(isBookable)
    .sort(
      (a, b) =>
        Number(isDoctor(b)) - Number(isDoctor(a)) ||
        `${a.firstName} ${a.lastName ?? ''}`.localeCompare(
          `${b.firstName} ${b.lastName ?? ''}`,
        ),
    )
    .map(staffOf);
}

// ── Slots ──

/** The contract's weekday of a calendar date. */
function weekdayOf(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAY_VALUES[(sundayFirst + 6) % 7] ?? 'mon';
}

function branchOf(branchId: string | undefined): Branch {
  const id = branchId ?? branchRef(MAIN_BRANCH);
  const branch = clinicFixtures.branches.snapshot((row) => row.id === id)[0];
  if (!branch) {
    throw clinicHttpError(422, 'validation', 'Pick a branch', {
      branchId: ['Pick a branch'],
    });
  }
  return branch;
}

function bookableStaff(doctorId: string): User {
  const doctor = clinicFixtures.staff.snapshot((row) => row.id === doctorId)[0];
  if (!(doctor && isBookable(doctor))) {
    throw clinicHttpError(422, 'validation', 'Pick a doctor', {
      doctorId: ['Pick a doctor'],
    });
  }
  return doctor;
}

/** A booking's minutes on its day. */
const spanOf = (visit: Pick<AppointmentRecord, 'startTime' | 'durationMin'>) => {
  const start = clockMinutes(visit.startTime);
  return { start, end: start + visit.durationMin };
};

/**
 * The doctor's bookings that hold time on a day (Q-A4: the same doctor,
 * overlapping time) — every one but a cancelled one, and but `exceptId`.
 */
function heldSpans(doctorId: string, date: string, exceptId: string | undefined) {
  return clinicFixtures.appointments
    .snapshot(
      (visit) =>
        visit.doctorId === doctorId &&
        visit.date === date &&
        visit.status !== 'cancelled' &&
        visit.id !== exceptId,
    )
    .map(spanOf);
}

const overlaps = (
  span: { start: number; end: number },
  held: readonly { start: number; end: number }[],
) => held.some((other) => span.start < other.end && other.start < span.end);

/**
 * The slot grid (`availableSlots`, `S:1605`; Q-A3): the starts inside the
 * branch's opening hours and the doctor's working days and hours, every
 * `step` minutes, the passed ones left out — free, or taken by an overlapping
 * booking of the same doctor.
 */
export async function listAvailableSlots(raw: unknown): Promise<AppointmentSlot[]> {
  const params = validateClinicInput(availableSlotsParamsSchema, raw);
  const now = new Date();
  const today = clinicToday(now);
  const doctor = bookableStaff(params.doctorId);
  const branch = branchOf(params.branchId);
  const weekday = weekdayOf(params.date);
  if (
    params.date < today ||
    !branch.workingDays.includes(weekday) ||
    !doctor.workingDays.includes(weekday)
  ) {
    return [];
  }
  const opens = Math.max(clockMinutes(branch.opensAt), clockMinutes(doctor.startsAt));
  const closes = Math.min(clockMinutes(branch.closesAt), clockMinutes(doctor.endsAt));
  const passed = params.date === today ? clockMinutes(clinicClockTime(now)) : -1;
  const held = heldSpans(params.doctorId, params.date, params.exceptId);
  const slots: AppointmentSlot[] = [];
  for (let start = opens; start + params.durationMin <= closes; start += params.step) {
    if (start <= passed) continue;
    slots.push({
      time: clockOfMinutes(start),
      free: !overlaps({ start, end: start + params.durationMin }, held),
    });
  }
  return slots;
}

// ── Writes: the rules ──

/** A 422 on one field. */
function refuse(field: string, message: string): never {
  throw clinicHttpError(422, 'validation', message, { [field]: [message] });
}

/** A 409 — a move the rules refuse, or a slot someone else holds. */
function conflict(code: string, message: string, field = 'status'): never {
  throw clinicHttpError(409, code, message, { [field]: [message] });
}

/** Blank Reason and Notes are none. */
function draftOf(fields: AppointmentFields): AppointmentFields {
  return { ...fields, reason: fields.reason || null, notes: fields.notes || null };
}

/** Refuse what the contract's server refuses: unknown people, doctor, branch, offering, package. */
function checkReferences(fields: AppointmentFields): void {
  const known = <T extends { id: string }>(
    collection: { snapshot: (where: (row: T) => boolean) => T[] },
    id: string | null,
  ) => id === null || collection.snapshot((row) => row.id === id).length > 0;
  if (!known(clinicFixtures.patients, fields.patientId)) {
    refuse('patientId', 'Pick who the appointment is for');
  }
  if (!known(clinicFixtures.leads, fields.leadId)) {
    refuse('leadId', 'Pick who the appointment is for');
  }
  bookableStaff(fields.doctorId);
  if (fields.therapistId !== null) bookableStaff(fields.therapistId);
  branchOf(fields.branchId);
  if (!known(clinicFixtures.offerings, fields.offeringId)) {
    refuse('offeringId', 'Pick a treatment');
  }
  if (!known(clinicFixtures.patientPackages, fields.patientPackageId)) {
    refuse('patientPackageId', 'Pick an active package');
  }
}

/**
 * A new or moved slot: in the future (422), inside the branch's opening hours
 * on one of its working days (422; `S:333`), and free for the doctor (409).
 */
function checkSlot(fields: AppointmentFields, now: Date, exceptId?: string): void {
  if (Date.parse(clinicInstant(fields.date, fields.startTime)) <= now.getTime()) {
    refuse('startTime', SLOT_PASSED);
  }
  const branch = branchOf(fields.branchId);
  const span = spanOf(fields);
  if (
    !branch.workingDays.includes(weekdayOf(fields.date)) ||
    span.start < clockMinutes(branch.opensAt) ||
    span.end > clockMinutes(branch.closesAt)
  ) {
    refuse('startTime', OUTSIDE_HOURS);
  }
  checkFree(fields, exceptId);
}

function checkFree(
  fields: Pick<AppointmentFields, 'doctorId' | 'date' | 'startTime' | 'durationMin'>,
  exceptId?: string,
): void {
  if (overlaps(spanOf(fields), heldSpans(fields.doctorId, fields.date, exceptId))) {
    conflict('slot_taken', SLOT_TAKEN, 'startTime');
  }
}

/** The person has a patient record — Completed needs one. */
const isPatientVisit = (visit: AppointmentRecord) =>
  personOf(visit, lookups()).kind === 'patient';

function guardText(
  reason: AppointmentGuardReason,
  visit: AppointmentRecord,
  to: AppointmentStatus,
  today: string,
): string {
  switch (reason) {
    case 'final':
      return FINAL;
    case 'visit_day':
      return `Only on ${dayLabel(visit.date, today)}`;
    case 'before_start':
      return `Available after ${clockLabel(visit.startTime)} on ${dayLabel(visit.date, today)}`;
    case 'needs_patient':
      return NEEDS_PATIENT;
    case 'no_access':
      return 'You don’t have access to do this';
    case 'not_allowed':
      return `${STATUS_TEXT[visit.status]} can’t move to ${STATUS_TEXT[to]}`;
  }
}

const RESTORE_TEXT: Readonly<Record<AppointmentRestoreReason, string>> = {
  no_access: 'You don’t have access to do this',
  not_cancelled: 'Only a cancelled appointment can be restored',
  time_passed: 'This time has passed · book a new appointment',
};

/** Keep a write's change for its Undo and answer its row. */
function answer(visit: AppointmentRecord, change: FixtureChange): AppointmentChange {
  const undoToken = crypto.randomUUID();
  undoLog.set(undoToken, change);
  return { appointment: rowOf(visit, lookups()), undoToken };
}

/** The guard subject of a stored booking. */
const subjectOf = (visit: AppointmentRecord) => ({
  status: visit.status,
  date: visit.date,
  startTime: visit.startTime,
  isPatient: isPatientVisit(visit),
});

/** A stored booking's own fields — what an edit merges its patch into. */
function fieldsOf(visit: AppointmentRecord): AppointmentFields {
  return {
    patientId: visit.patientId,
    leadId: visit.leadId,
    branchId: visit.branchId,
    type: visit.type,
    offeringId: visit.offeringId,
    serviceLabel: visit.serviceLabel,
    doctorId: visit.doctorId,
    therapistId: visit.therapistId,
    room: visit.room,
    date: visit.date,
    startTime: visit.startTime,
    durationMin: visit.durationMin,
    reason: visit.reason,
    notes: visit.notes,
    followUpAt: visit.followUpAt,
    patientPackageId: visit.patientPackageId,
  };
}

// ── Writes ──

/**
 * Book (`createAppointment`, `S:1609`): the slot must be ahead, inside the
 * branch's hours and free for the doctor; the type defaults to Consultation
 * and its length, the service to the offering's name (else the type's), the
 * branch to the member's; Reason and Notes are kept (Q-A9). It saves as Scheduled — the
 * confirm request goes out, and the rule job may raise "Confirm visits".
 */
export async function createAppointment(
  input: AppointmentCreateInput,
): Promise<AppointmentRow> {
  const now = new Date();
  const { copyOf, ...given } = input;
  const type = given.type ?? 'consultation';
  const offering = given.offeringId
    ? clinicFixtures.offerings.snapshot((row) => row.id === given.offeringId)[0]
    : undefined;
  const fields = draftOf(
    validateClinicInput(appointmentInputSchema, {
      patientId: null,
      leadId: null,
      branchId: branchRef(MAIN_BRANCH),
      offeringId: null,
      therapistId: null,
      room: null,
      reason: null,
      notes: null,
      followUpAt: null,
      patientPackageId: null,
      type,
      durationMin: APPOINTMENT_TYPE_MINUTES[type],
      serviceLabel: offering?.name ?? TYPE_SERVICE[type],
      ...definedFields(given),
    }),
  );
  checkReferences(fields);
  checkSlot(fields, now);
  const source = copyOf
    ? clinicFixtures.appointments.snapshot((row) => row.id === copyOf)[0]
    : undefined;
  if (copyOf && !source) refuse('copyOf', 'Appointment not found');
  const change = recordFixtureChange();
  const created = await change.create(clinicFixtures.appointments, {
    ...fields,
    status: 'scheduled',
    cancelReason: null,
    cancelNote: null,
    rescheduledFrom: null,
    checkedInAt: null,
    completedAt: null,
    copiedFromId: source?.id ?? null,
    reminder: null,
    repliedYes: false,
    moveCount: 0,
  });
  await syncTaskRules(now, change);
  return rowOf(created, lookups());
}

/** The status an edit lands on: a move returns the booking to Scheduled (`S:1610`). */
function statusAfterEdit(
  saved: AppointmentRecord,
  requested: AppointmentStatus | undefined,
  fields: AppointmentFields,
  context: { moved: boolean; today: string },
): AppointmentStatus {
  if (context.moved) return 'scheduled';
  const next = requested ?? saved.status;
  const guard = formStatusGuard(saved.status, next, {
    date: fields.date,
    today: context.today,
    isPatient: isPatientVisit({ ...saved, ...fields }),
  });
  if (!guard.allowed) {
    conflict('invalid_transition', guardText(guard.reason, saved, next, context.today));
  }
  return next;
}

/**
 * Save an edit (`updateAppointment`, `S:1610`): the patch merged into the
 * saved booking and checked whole. A new date or time on a Scheduled or
 * Confirmed booking moves it — back to Scheduled, `rescheduledFrom` the old
 * slot, one more move, a fresh confirm request; once checked in the slot is
 * locked (409). A status from the form's tiles follows {@link formStatusGuard}.
 * A cancelled or no-show booking takes no edit.
 */
export async function updateAppointment(
  id: string,
  patch: AppointmentPatch,
): Promise<AppointmentUpdate> {
  const now = new Date();
  const today = clinicToday(now);
  const saved = await clinicFixtures.appointments.get(id);
  if (saved.status === 'cancelled') {
    conflict('cancelled', 'Restore this appointment to change it');
  }
  if (saved.status === 'no_show')
    conflict('closed', 'This appointment is closed · No show');
  const { status: rawStatus, ...fieldPatch } = patch;
  const requested =
    rawStatus === undefined
      ? undefined
      : validateClinicInput(appointmentStatusSchema, rawStatus);
  const fields = draftOf(
    validateClinicInput(appointmentInputSchema, {
      ...fieldsOf(saved),
      ...definedFields(fieldPatch),
    }),
  );
  const moved = fields.date !== saved.date || fields.startTime !== saved.startTime;
  if (moved && isAppointmentSlotLocked(saved.status)) {
    conflict('slot_locked', SLOT_LOCKED, 'startTime');
  }
  checkReferences(fields);
  if (moved) checkSlot(fields, now, id);
  else if (
    fields.doctorId !== saved.doctorId ||
    fields.durationMin !== saved.durationMin
  ) {
    checkFree(fields, id);
  }
  const next = statusAfterEdit(saved, requested, fields, { moved, today });

  const change = recordFixtureChange();
  let visit = await change.update(clinicFixtures.appointments, id, {
    ...fields,
    ...(moved
      ? {
          rescheduledFrom: clinicInstant(saved.date, saved.startTime),
          moveCount: saved.moveCount + 1,
        }
      : {}),
  });
  if (moved || next !== saved.status) {
    visit = await writeAppointmentStatus(change, visit, next, { now });
  }
  await syncTaskRules(now, change);
  return { appointment: rowOf(visit, lookups()), moved };
}

/**
 * Move a booking's status (`setAppointmentStatus`, `S:1582`) through the
 * status machine — 409 with the guard's words when it refuses — and its
 * effects: stamps, open leads to Clinic visited, the rule tasks. Answers an
 * Undo token for the 10s toast.
 */
export async function setAppointmentStatus(
  input: AppointmentStatusInput,
): Promise<AppointmentChange> {
  const { id, status } = validateClinicInput(appointmentStatusInputSchema, input);
  const now = new Date();
  const visit = await clinicFixtures.appointments.get(id);
  const guard = transitionGuard(subjectOf(visit), status, { now });
  if (!guard.allowed) {
    conflict(
      'invalid_transition',
      guardText(guard.reason, visit, status, clinicToday(now)),
    );
  }
  const change = recordFixtureChange();
  const saved = await writeAppointmentStatus(change, visit, status, { now });
  await syncTaskRules(now, change);
  return answer(saved, change);
}

/**
 * Cancel (`cancelAppointment`, `S:1611`) with one of the contract's reasons
 * (D32) — "Other" needs a note (422): the slot frees and reminders stop.
 * Answers an Undo token that brings back the status it had.
 */
export async function cancelAppointment(
  input: AppointmentCancelInput,
): Promise<AppointmentChange> {
  const cancel = validateClinicInput(appointmentCancelInputSchema, input);
  const now = new Date();
  const visit = await clinicFixtures.appointments.get(cancel.id);
  const guard = transitionGuard(subjectOf(visit), 'cancelled', { now });
  if (!guard.allowed) {
    conflict(
      'invalid_transition',
      guardText(guard.reason, visit, 'cancelled', clinicToday(now)),
    );
  }
  const change = recordFixtureChange();
  const saved = await writeAppointmentStatus(change, visit, 'cancelled', {
    now,
    cancelReason: cancel.reason,
    cancelNote: cancel.note,
  });
  await syncTaskRules(now, change);
  return answer(saved, change);
}

/**
 * Restore a cancelled booking (`restoreAppointment`, `S:1612`) — to Scheduled,
 * the plan's rule (Appendix F; the contract restores the previous status) —
 * while its time is still ahead and its slot still free (409 otherwise). The
 * reminder goes out again.
 */
export async function restoreAppointment(id: string): Promise<AppointmentRow> {
  const now = new Date();
  const visit = await clinicFixtures.appointments.get(id);
  const guard = restoreGuard(visit, { now });
  if (!guard.allowed) conflict('cannot_restore', RESTORE_TEXT[guard.reason]);
  checkFree(visit, id);
  const change = recordFixtureChange();
  const saved = await writeAppointmentStatus(change, visit, 'scheduled', { now });
  await syncTaskRules(now, change);
  return rowOf(saved, lookups());
}

/** Undo a status write — its every record change, side effects included (each token works once). */
export async function undoAppointmentChange(undoToken: string): Promise<void> {
  const change = undoLog.get(undoToken);
  if (!change)
    conflict('undo_unavailable', 'This change can no longer be undone', 'undoToken');
  undoLog.delete(undoToken);
  await change.reverse();
}
