/**
 * Test data for the Appointments room, the appointment form and the hooks under them, as
 * clinozy-be answers it (`/app/appointments`, `/app/contacts`, `/app/memberships`): a booking
 * row with its doctor joined, a member of the team, a person the search finds, a day's counts
 * and a day's free slots. Ids are public ids (`<prefix>_<21 [a-z0-9]>`). Override what a test
 * is about; the rest stays a plausible Scheduled consultation tomorrow at 10:30.
 */
import { appInstant } from '@/shared/api/app/app-time.ts';
import type {
  AppointmentDayCount,
  AppointmentRow,
  AppointmentSlotDay,
  AppointmentStaff,
} from '@/shared/api/app/appointments-contracts.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';

/** 09:00 on Sat 3 Oct 2026, clinic time — the appointment tests' "now". */
export const APPOINTMENT_NOW = new Date(appInstant('2026-10-03', '09:00'));

/** The clinic day {@link APPOINTMENT_NOW} falls on. */
export const APPOINTMENT_TODAY = '2026-10-03';

/** The day after {@link APPOINTMENT_TODAY}. */
export const APPOINTMENT_TOMORROW = '2026-10-04';

/** The branch every test booking files under. */
export const TEST_BRANCH_ID = 'brn_main0000000000000000';

/** A member of the team — Dr. Nisha Shah unless told otherwise. */
export function teamDoctor(overrides: Partial<AppointmentStaff> = {}): AppointmentStaff {
  return {
    id: 'mem_nisha0000000000000000',
    userId: 'usr_nisha0000000000000000',
    name: 'Nisha Shah',
    initials: 'NS',
    tone: 'sky',
    roleIds: [],
    branchIds: [TEST_BRANCH_ID],
    ...overrides,
  };
}

/** Dr. Nisha Shah. */
export const DOCTOR_NISHA = teamDoctor();

/** Dr. Arjun Rao. */
export const DOCTOR_ARJUN = teamDoctor({
  id: 'mem_arjun0000000000000000',
  userId: 'usr_arjun0000000000000000',
  name: 'Arjun Rao',
  initials: 'AR',
  tone: 'sage',
});

/** A person the search finds — Riya Mehta, with an open lead and no patient file. */
export function contactHit(overrides: Partial<ContactSummary> = {}): ContactSummary {
  return {
    id: 'con_riya00000000000000000',
    contactNumber: 1201,
    firstName: 'Riya',
    lastName: 'Mehta',
    name: 'Riya Mehta',
    primaryPhone: '+919825011241',
    email: null,
    instagramHandles: [],
    defaultChannel: 'whatsapp',
    preferenceTags: [],
    patientId: null,
    openLeadId: 'lead_riya00000000000000000',
    lastActivityAt: null,
    lastReceivedAt: null,
    isAwaitingReply: false,
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

/**
 * A booking as a view reads it — #2861, Riya Mehta (a lead) with Dr. Nisha, a Scheduled 20-minute
 * consultation tomorrow at 10:30.
 */
export function appointmentRow(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  const contactId = overrides.contactId ?? 'con_riya00000000000000000';
  const patientId = overrides.patientId ?? null;
  const leadId =
    overrides.leadId === undefined ? 'lead_riya00000000000000000' : overrides.leadId;
  let kind: AppointmentRow['person']['kind'] = 'contact';
  if (patientId) kind = 'patient';
  else if (leadId) kind = 'lead';
  return {
    id: 'appt_riya00000000000000000',
    seq: 2861,
    contactId,
    person: {
      kind,
      contactId,
      name: 'Riya Mehta',
      phone: '+919825011241',
      patientId,
      leadId,
      contactNumber: 1201,
    },
    patientId,
    leadId,
    branchId: TEST_BRANCH_ID,
    type: 'consultation',
    offeringId: null,
    serviceLabel: 'Consultation',
    doctorId: DOCTOR_NISHA.id,
    therapistId: null,
    roomId: null,
    machineId: null,
    date: APPOINTMENT_TOMORROW,
    startTime: '10:30',
    endTime: '10:50',
    durationMin: 20,
    status: 'scheduled',
    cancelReason: null,
    cancelNote: null,
    rescheduledFrom: null,
    reason: null,
    notes: null,
    followUpAt: null,
    checkedInAt: null,
    completedAt: null,
    copiedFromId: null,
    reminder: 'not_sent',
    repliedYes: false,
    moveCount: 0,
    visitStage: null,
    isWalkIn: false,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    doctor: DOCTOR_NISHA,
    ...overrides,
  };
}

/** A day's counts — every status, zeros unless given. */
export function dayCount(
  date: string,
  byStatus: Partial<AppointmentDayCount['byStatus']> = {},
): AppointmentDayCount {
  const counts = {
    scheduled: 0,
    confirmed: 0,
    checked_in: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    ...byStatus,
  };
  return {
    date,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    byStatus: counts,
  };
}

/** An open day's free starts (each `minutes` long), or a closed day by its reason. */
export function slotDay(
  date: string,
  starts: readonly string[],
  closed: Pick<AppointmentSlotDay, 'closedReason' | 'closedLabel'> | null = null,
  minutes = 20,
): AppointmentSlotDay {
  const end = (time: string) => {
    const [hours = 0, mins = 0] = time.split(':').map(Number);
    const total = hours * 60 + mins + minutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  return closed
    ? { date, isOpen: false, ...closed, slots: [] }
    : {
        date,
        isOpen: true,
        closedReason: null,
        closedLabel: null,
        slots: starts.map((time) => ({ time, endTime: end(time) })),
      };
}
