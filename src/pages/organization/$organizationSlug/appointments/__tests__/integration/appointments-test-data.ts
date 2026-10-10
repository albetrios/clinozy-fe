import { vi } from 'vitest';

import {
  type AppointmentCancel,
  type AppointmentCreateInput,
  type AppointmentDayCount,
  type AppointmentFields,
  type AppointmentFilters,
  type AppointmentListParams,
  type AppointmentMoveRoute,
  type AppointmentRangeParams,
  type AppointmentRow,
  type AppointmentSlotParams,
  statusesForFilter,
} from '@/shared/api/clinic/appointments-contracts.ts';
import type { AppointmentStatus } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicInstant, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import {
  APPOINTMENT_TODAY,
  appointmentRow,
  dayCount,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  slotDay,
} from '@/tests/utils/appointment-doubles.ts';

/** A public id — `<prefix>_<21 [a-z0-9]>` — from a short readable stem (`appt_kabir0…`). */
export const publicId = (prefix: string, stem: string) =>
  `${prefix}_${stem}${'0'.repeat(21 - stem.length)}`;

/** Monday 5 Oct 2026 — two days after the tests' today. */
const APPOINTMENT_MONDAY = '2026-10-05';

/** The team the room's tests read: Dr. Nisha and Dr. Arjun. */
const TEAM: readonly DirectoryMember[] = [DOCTOR_NISHA, DOCTOR_ARJUN];

/** A booking for someone other than Riya — their name, contact and patient file as asked. */
function personBooking(
  stem: string,
  seq: number,
  name: string,
  overrides: Partial<AppointmentRow>,
): AppointmentRow {
  const contactId = publicId('con', stem);
  const patientId = overrides.patientId ?? null;
  const leadId = overrides.leadId ?? null;
  let kind: AppointmentRow['person']['kind'] = 'contact';
  if (patientId) kind = 'patient';
  else if (leadId) kind = 'lead';
  return appointmentRow({
    id: publicId('appt', stem),
    seq,
    contactId,
    patientId,
    leadId,
    ...overrides,
    person: {
      kind,
      contactId,
      name,
      phone: '+919825044120',
      patientId,
      leadId,
      contactNumber: seq - 1000,
    },
  });
}

/** Riya Mehta (#2861) — a lead, Scheduled with Dr. Nisha tomorrow at 10:30. */
export const RIYA_BOOKING = appointmentRow();

/** Kabir Rao (#2862) — a patient, Confirmed by a WhatsApp Yes with Dr. Arjun today at 11:30. */
export const KABIR_BOOKING = personBooking('kabir', 2862, 'Kabir Rao', {
  patientId: publicId('pat', 'kabir'),
  doctorId: DOCTOR_ARJUN.id,
  doctor: DOCTOR_ARJUN,
  date: APPOINTMENT_TODAY,
  startTime: '11:30',
  endTime: '12:00',
  durationMin: 30,
  serviceLabel: 'Follow-up',
  type: 'follow_up',
  status: 'confirmed',
  reminder: 'reminder_sent',
  repliedYes: true,
});

/** Meera Iyer (#2863) — a patient, Checked in with Dr. Nisha today at 08:30. */
export const MEERA_BOOKING = personBooking('meera', 2863, 'Meera Iyer', {
  patientId: publicId('pat', 'meera'),
  date: APPOINTMENT_TODAY,
  startTime: '08:30',
  endTime: '09:30',
  durationMin: 60,
  serviceLabel: 'HydraFacial',
  type: 'treatment',
  status: 'checked_in',
  checkedInAt: clinicInstant(APPOINTMENT_TODAY, '08:35'),
});

/** Dev Shah (#2864) — a contact, Scheduled with Dr. Arjun tomorrow at 12:00, moved twice. */
export const DEV_BOOKING = personBooking('dev', 2864, 'Dev Shah', {
  doctorId: DOCTOR_ARJUN.id,
  doctor: DOCTOR_ARJUN,
  startTime: '12:00',
  endTime: '12:20',
  moveCount: 2,
  rescheduledFrom: clinicInstant('2026-10-02', '16:30'),
});

/** Tara Kapoor (#2865) — a lead, Cancelled with Dr. Nisha today at 13:00. */
const TARA_BOOKING = personBooking('tara', 2865, 'Tara Kapoor', {
  leadId: publicId('lead', 'tara'),
  date: APPOINTMENT_TODAY,
  startTime: '13:00',
  endTime: '13:20',
  status: 'cancelled',
  cancelReason: 'unreachable',
});

/** Isha Nair (#2866) — a patient, Confirmed with Dr. Nisha on Monday, the reminder sent. */
const ISHA_BOOKING = personBooking('isha', 2866, 'Isha Nair', {
  patientId: publicId('pat', 'isha'),
  date: APPOINTMENT_MONDAY,
  startTime: '16:00',
  endTime: '16:20',
  status: 'confirmed',
  reminder: 'reminder_sent',
});

/** Omar Khan (#2840) — a patient, a No show with Dr. Arjun yesterday. */
export const OMAR_BOOKING = personBooking('omar', 2840, 'Omar Khan', {
  patientId: publicId('pat', 'omar'),
  doctorId: DOCTOR_ARJUN.id,
  doctor: DOCTOR_ARJUN,
  date: '2026-10-02',
  startTime: '15:00',
  endTime: '15:20',
  status: 'no_show',
});

/**
 * The clinozy-be an Appointments test runs against: the bookings every read answers from and
 * every write changes; `pageSize` cuts the Agenda into cursor pages; `counts` answers the day
 * counts instead of counting the bookings; `hold`, while set, keeps every write waiting.
 */
export interface AppointmentsWorld {
  rows: AppointmentRow[];
  pageSize: number;
  counts: AppointmentDayCount[] | null;
  hold: Promise<void> | null;
}

/** A fresh world: the seven bookings above, one page each read. */
export function seededAppointmentsWorld(): AppointmentsWorld {
  return {
    rows: [
      OMAR_BOOKING,
      MEERA_BOOKING,
      KABIR_BOOKING,
      TARA_BOOKING,
      RIYA_BOOKING,
      DEV_BOOKING,
      ISHA_BOOKING,
    ].map((row) => structuredClone(row)),
    pageSize: 50,
    counts: null,
    hold: null,
  };
}

/** Whether a booking passes the shared filters — the status, the doctor, the branches and the search. */
function inFilters(row: AppointmentRow, filters: AppointmentFilters): boolean {
  const q = filters.q?.trim().toLowerCase();
  return (
    statusesForFilter(filters.status).includes(row.status) &&
    (!filters.doctorId || row.doctorId === filters.doctorId) &&
    (filters.branchIds.length === 0 || filters.branchIds.includes(row.branchId)) &&
    (!q || row.person.name.toLowerCase().includes(q) || `#${row.seq}` === q)
  );
}

/** The API's order: by date, then start. */
const bySlot = (rows: AppointmentRow[]) =>
  [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );

/** The status each move route arrives at. */
const MOVED_TO: Readonly<Record<AppointmentMoveRoute, AppointmentStatus>> = {
  confirm: 'confirmed',
  'check-in': 'checked_in',
  complete: 'completed',
  'no-show': 'no_show',
  reinstate: 'scheduled',
  'undo-check-in': 'confirmed',
};

/**
 * `@/shared/api/clinic/appointments-api.ts` over an {@link AppointmentsWorld} — every read
 * answers from it and every write changes it, so a later read shows the write. An unknown id is
 * a 404.
 */
export function appointmentsApiDouble(world: AppointmentsWorld) {
  const find = (appointmentId: string) => {
    const row = world.rows.find((entry) => entry.id === appointmentId);
    if (!row) {
      throw new HttpError('Not found', 404, `/app/appointments/${appointmentId}`, 'GET');
    }
    return row;
  };
  const change = async (appointmentId: string, patch: Partial<AppointmentRow>) => {
    if (world.hold) await world.hold;
    const next = {
      ...find(appointmentId),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    world.rows = world.rows.map((entry) => (entry.id === appointmentId ? next : entry));
    return structuredClone(next);
  };
  const book = async (row: AppointmentRow) => {
    if (world.hold) await world.hold;
    world.rows = [...world.rows, row];
    return structuredClone(row);
  };
  const nextSeq = () => Math.max(...world.rows.map((row) => row.seq)) + 1;
  return {
    listAppointments: vi.fn(async (params: AppointmentListParams, after?: string) => {
      const from = params.date ?? clinicToday();
      const rows = bySlot(
        world.rows.filter(
          (row) =>
            inFilters(row, params) &&
            (params.date ? row.date === params.date : row.date >= from),
        ),
      );
      const start = after ? Number(after.replace('page-', '')) : 0;
      const end = start + world.pageSize;
      return {
        rows: structuredClone(rows.slice(start, end)),
        next: end < rows.length ? `page-${end}` : null,
        total: rows.length,
      };
    }),
    fetchAppointmentRange: vi.fn(async (params: AppointmentRangeParams) =>
      structuredClone(
        bySlot(
          world.rows.filter(
            (row) =>
              inFilters(row, params) && row.date >= params.from && row.date <= params.to,
          ),
        ),
      ),
    ),
    fetchAppointmentDayCounts: vi.fn(
      async (window: {
        from: string;
        to: string;
        doctorId?: string;
        branchIds: readonly string[];
      }) => {
        const inWindow = (date: string) => date >= window.from && date <= window.to;
        if (world.counts) return world.counts.filter((day) => inWindow(day.date));
        const days = new Map<string, Partial<Record<AppointmentStatus, number>>>();
        for (const row of world.rows) {
          if (!inWindow(row.date)) continue;
          if (window.doctorId && row.doctorId !== window.doctorId) continue;
          const counts = days.get(row.date) ?? {};
          counts[row.status] = (counts[row.status] ?? 0) + 1;
          days.set(row.date, counts);
        }
        return [...days]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, counts]) => dayCount(date, counts));
      },
    ),
    fetchAppointment: vi.fn(async (appointmentId: string) =>
      structuredClone(find(appointmentId)),
    ),
    fetchAppointmentSlots: vi.fn(async (params: AppointmentSlotParams) =>
      slotDay(params.date, ['10:00', '10:30', '11:00']),
    ),
    fetchBookableTreatments: vi.fn(async () => []),
    createAppointment: vi.fn(
      async ({ input }: { input: AppointmentCreateInput; idempotencyKey: string }) => {
        const seq = nextSeq();
        return book(
          appointmentRow({
            ...input,
            id: publicId('appt', `n${seq}`),
            seq,
            doctor: TEAM.find((member) => member.id === input.doctorId) ?? null,
          }),
        );
      },
    ),
    copyAppointment: vi.fn(
      async ({
        appointmentId,
        date,
        startTime,
      }: {
        appointmentId: string;
        date: string;
        startTime: string;
        idempotencyKey: string;
      }) => {
        const seq = nextSeq();
        return book({
          ...find(appointmentId),
          id: publicId('appt', `n${seq}`),
          seq,
          date,
          startTime,
          status: 'scheduled',
          copiedFromId: appointmentId,
        });
      },
    ),
    updateAppointment: vi.fn(
      async ({
        appointmentId,
        fields,
      }: {
        appointmentId: string;
        fields: Partial<AppointmentFields>;
        expectedUpdatedAt: string;
        idempotencyKey: string;
      }) => change(appointmentId, fields),
    ),
    moveAppointment: vi.fn(
      async ({
        appointmentId,
        route,
      }: {
        appointmentId: string;
        route: AppointmentMoveRoute;
        idempotencyKey: string;
      }) => change(appointmentId, { status: MOVED_TO[route] }),
    ),
    cancelAppointment: vi.fn(
      async ({
        appointmentId,
        cancel,
      }: {
        appointmentId: string;
        cancel: AppointmentCancel;
        idempotencyKey: string;
      }) =>
        change(appointmentId, {
          status: 'cancelled',
          cancelReason: cancel.reason,
          cancelNote: cancel.note,
        }),
    ),
  };
}

/** `@/shared/api/clinic/directory-api.ts`'s team reads over {@link TEAM}. */
export function directoryApiDouble() {
  return {
    fetchTeamDirectory: vi.fn(async () => structuredClone([...TEAM])),
    fetchMemberNames: vi.fn(
      async (ids: readonly string[]): Promise<ReadonlyMap<string, string>> =>
        new Map(
          TEAM.filter((member) => ids.includes(member.id)).map(
            (member) => [member.id, member.name] as const,
          ),
        ),
    ),
  };
}

/** A promise a test settles itself — `world.hold` keeps the writes waiting on it. */
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** The day the form stand-in's New save books on (`appointment-form-stand-in.tsx`). */
export const STAND_IN_BOOKED_DATE = '2026-10-07';

/** The booking the form stand-in's chat chip ("Open") names — Kabir's. */
export const STAND_IN_OTHER_ID = KABIR_BOOKING.id;

/** What the form stand-in was opened with — its `form` output read back. */
export function standInForm(output: HTMLElement): {
  mode: string;
  prefill?: Record<string, unknown>;
  appointmentId?: string;
  seq: number | null;
  readOnly: boolean;
} {
  return JSON.parse(output.textContent ?? '{}');
}
