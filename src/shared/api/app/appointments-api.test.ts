import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('./directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
  fetchMemberNames: vi.fn(),
}));
import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
  dayCount,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  slotDay,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

import {
  appointmentListQuery,
  appointmentQueryKeys,
  cancelAppointment,
  copyAppointment,
  createAppointment,
  fetchAppointment,
  fetchAppointmentDayCounts,
  fetchAppointmentRange,
  fetchAppointmentSlots,
  fetchPersonAppointments,
  listAppointments,
  moveAppointment,
  updateAppointment,
} from './appointments-api.ts';
import {
  type AppointmentFilters,
  type AppointmentMoveRoute,
  bookableTreatmentsOf,
} from './appointments-contracts.ts';
import { fetchMemberNames, fetchTeamDirectory } from './directory-api.ts';

const APPOINTMENT_ID = 'appt_riya00000000000000000';
const CONTACT_ID = 'con_riya00000000000000000';
const LEAD_ID = 'lead_riya00000000000000000';
const PATIENT_ID = 'pat_riya000000000000000000';
const OTHER_BRANCH_ID = 'brn_west0000000000000000';
const FORMER_DOCTOR_ID = 'mem_dev00000000000000000';

/** No filter but Active, every branch — the room's first read. */
const ACTIVE: AppointmentFilters = { status: 'active', branchIds: [] };

/** A booking as clinozy-be answers it — the wire of `appointmentRow()`. */
const wireRow = (patch: Record<string, unknown> = {}) => ({
  id: APPOINTMENT_ID,
  appointment_number: 2861,
  contact_id: CONTACT_ID,
  contact: {
    contact_number: 1201,
    first_name: 'Riya',
    last_name: 'Mehta',
    primary_phone: '+919825011241',
  },
  patient_id: null,
  lead_id: LEAD_ID,
  branch_id: TEST_BRANCH_ID,
  type: 'consultation',
  offering_id: null,
  service_label: 'Consultation',
  doctor_membership_id: DOCTOR_NISHA.id,
  therapist_membership_id: null,
  branch_room_id: null,
  branch_machine_id: null,
  appointment_date: APPOINTMENT_TOMORROW,
  start_time: '10:30',
  end_time: '10:50',
  duration_minutes: 20,
  status: 'scheduled',
  cancel_reason: null,
  cancel_note: null,
  rescheduled_from: null,
  reason: null,
  notes: null,
  follow_up_at: null,
  checked_in_at: null,
  completed_at: null,
  copied_from_appointment_id: null,
  reminder_status: 'not_sent',
  is_confirmed_by_reply: false,
  move_count: 0,
  visit_stage: null,
  is_walk_in: false,
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
  ...patch,
});

/** One list page as clinozy-be answers it. */
const page = (
  rows: unknown[],
  pagination: { next?: string | null; has_more?: boolean; estimated_total?: number } = {},
) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 50, next: null, has_more: false, ...pagination },
  },
});

/** The query the last GET sent. */
function lastQuery(): Record<string, unknown> {
  const init = vi.mocked(api.get).mock.lastCall?.[1] as
    { query?: Record<string, unknown> } | undefined;
  return init?.query ?? {};
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  queryClient.clear();
  signInTestMember();
  vi.mocked(fetchTeamDirectory).mockResolvedValue([DOCTOR_NISHA, DOCTOR_ARJUN]);
  vi.mocked(fetchMemberNames).mockResolvedValue(new Map());
});
afterEach(() => {
  vi.useRealTimers();
  queryClient.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('appointmentListQuery (the Agenda)', () => {
  it('reads the Active bookings from today on, fifty a page', () => {
    expect(appointmentListQuery(ACTIVE, APPOINTMENT_TODAY)).toEqual({
      status: 'scheduled,confirmed,checked_in',
      limit: 50,
      appointment_date_from: APPOINTMENT_TODAY,
    });
  });

  it('reads every status for All, and one status by itself', () => {
    expect(
      appointmentListQuery({ ...ACTIVE, status: 'all' }, APPOINTMENT_TODAY).status,
    ).toBeUndefined();
    expect(
      appointmentListQuery({ ...ACTIVE, status: 'no_show' }, APPOINTMENT_TODAY),
    ).toMatchObject({ status: 'no_show' });
  });

  it('reads only the one day picked in Filters, past days included', () => {
    expect(
      appointmentListQuery({ ...ACTIVE, date: '2026-10-01' }, APPOINTMENT_TODAY),
    ).toMatchObject({
      appointment_date_from: '2026-10-01',
      appointment_date_to: '2026-10-01',
    });
  });

  it('sends the one doctor, the branches joined, the search trimmed and the Created range', () => {
    expect(
      appointmentListQuery(
        {
          status: 'confirmed',
          doctorId: DOCTOR_ARJUN.id,
          branchIds: [TEST_BRANCH_ID, OTHER_BRANCH_ID],
          q: '  riya ',
          created: 'today',
        },
        APPOINTMENT_TODAY,
      ),
    ).toEqual({
      status: 'confirmed',
      doctor_membership_id: DOCTOR_ARJUN.id,
      branch_ids: `${TEST_BRANCH_ID},${OTHER_BRANCH_ID}`,
      q: 'riya',
      created_from: '2026-10-02T18:30:00.000Z',
      created_to: '2026-10-03T18:30:00.000Z',
      limit: 50,
      appointment_date_from: APPOINTMENT_TODAY,
    });
  });

  it('sends no search for blank typing, and reads from the clinic’s today by default', () => {
    expect(appointmentListQuery({ ...ACTIVE, q: '   ' }).q).toBeUndefined();
    expect(appointmentListQuery(ACTIVE)).toEqual(
      appointmentListQuery(ACTIVE, APPOINTMENT_TODAY),
    );
  });
});

describe('listAppointments', () => {
  it('reads one page after the cursor, each booking with its doctor from the team', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([wireRow()], {
        next: 'cursor-2',
        has_more: true,
        estimated_total: 120,
      }) as never,
    );

    const result = await listAppointments(ACTIVE, 'cursor-1');

    expect(api.get).toHaveBeenCalledWith('/app/appointments', {
      query: { ...appointmentListQuery(ACTIVE), after: 'cursor-1' },
    });
    expect(result).toEqual({ rows: [appointmentRow()], next: 'cursor-2', total: 120 });
    expect(fetchMemberNames).not.toHaveBeenCalled();
  });

  it('ends at the last page, and has no total when the API counts none', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [wireRow()],
      meta: {
        request_id: 'req',
        pagination: { per_page: 50, next: 'x', has_more: false },
      },
    } as never);

    expect(await listAppointments(ACTIVE)).toMatchObject({ next: null, total: null });
  });

  it('reads the team once and keeps it for the next page', async () => {
    vi.mocked(api.get).mockResolvedValue(page([wireRow()]) as never);

    await listAppointments(ACTIVE);
    await listAppointments(ACTIVE, 'cursor-2');

    expect(fetchTeamDirectory).toHaveBeenCalledTimes(1);
  });

  it('reads no team for an empty page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([]) as never);

    expect((await listAppointments(ACTIVE)).rows).toEqual([]);
    expect(fetchTeamDirectory).not.toHaveBeenCalled();
  });

  it('names a doctor who has left from the member names, and leaves an unknown one empty', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        wireRow({ doctor_membership_id: FORMER_DOCTOR_ID }),
        wireRow({ id: 'appt_gone00000000000000000', doctor_membership_id: 'mem_gone' }),
      ]) as never,
    );
    vi.mocked(fetchMemberNames).mockResolvedValueOnce(
      new Map([[FORMER_DOCTOR_ID, 'Dev Shah']]),
    );

    const { rows } = await listAppointments(ACTIVE);

    expect(fetchMemberNames).toHaveBeenCalledWith([FORMER_DOCTOR_ID, 'mem_gone']);
    expect(rows[0]?.doctor).toEqual({
      id: FORMER_DOCTOR_ID,
      userId: '',
      name: 'Dev Shah',
      initials: 'DS',
      tone: expect.any(String),
      roleIds: [],
      branchIds: [],
    });
    expect(rows[1]?.doctor).toBeNull();
  });

  it('names whom a booking is for by the files the contact has', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        wireRow({ patient_id: PATIENT_ID }),
        wireRow(),
        wireRow({ lead_id: null }),
        wireRow({ lead_id: null, contact: null }),
      ]) as never,
    );

    const { rows } = await listAppointments(ACTIVE);

    expect(rows.map((row) => row.person.kind)).toEqual([
      'patient',
      'lead',
      'contact',
      'contact',
    ]);
    expect(rows[0]?.person).toMatchObject({ patientId: PATIENT_ID, leadId: LEAD_ID });
    // A contact who is gone keeps the booking, without a name, number or contact number.
    expect(rows[3]?.person).toEqual({
      kind: 'contact',
      contactId: CONTACT_ID,
      name: '',
      phone: null,
      patientId: null,
      leadId: null,
      contactNumber: null,
    });
  });

  it('reads the server’s reminder, reply, moves and floor stage', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        wireRow({
          status: 'checked_in',
          reminder_status: 'reminder_sent',
          is_confirmed_by_reply: true,
          move_count: 2,
          visit_stage: 'with_doctor',
          rescheduled_from: '2026-10-02T05:00:00.000Z',
          copied_from_appointment_id: 'appt_first0000000000000000',
        }),
      ]) as never,
    );

    const [row] = (await listAppointments(ACTIVE)).rows;

    expect(row).toMatchObject({
      status: 'checked_in',
      reminder: 'reminder_sent',
      repliedYes: true,
      moveCount: 2,
      visitStage: 'with_doctor',
      rescheduledFrom: '2026-10-02T05:00:00.000Z',
      copiedFromId: 'appt_first0000000000000000',
    });
  });
});

describe('fetchAppointmentRange (the calendars)', () => {
  it('reads every page of the range, a hundred at a time, with the filters', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        page([wireRow()], { next: 'cursor-2', has_more: true }) as never,
      )
      .mockResolvedValueOnce(
        page([
          wireRow({
            id: 'appt_arjun0000000000000000',
            doctor_membership_id: DOCTOR_ARJUN.id,
          }),
        ]) as never,
      );

    const rows = await fetchAppointmentRange({
      ...ACTIVE,
      doctorId: DOCTOR_ARJUN.id,
      from: APPOINTMENT_TODAY,
      to: '2026-10-09',
    });

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/appointments', {
      query: {
        status: 'scheduled,confirmed,checked_in',
        doctor_membership_id: DOCTOR_ARJUN.id,
        limit: 100,
        appointment_date_from: APPOINTMENT_TODAY,
        appointment_date_to: '2026-10-09',
      },
    });
    expect(lastQuery()).toMatchObject({ after: 'cursor-2' });
    expect(rows.map((row) => row.doctor?.name)).toEqual(['Nisha Shah', 'Arjun Rao']);
    expect(fetchTeamDirectory).toHaveBeenCalledTimes(1);
  });
});

describe('fetchPersonAppointments (the patient file’s Visits)', () => {
  it('reads every page of the person’s bookings, newest first, a hundred at a time', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        page([wireRow({ patient_id: PATIENT_ID })], {
          next: 'cursor-2',
          has_more: true,
        }) as never,
      )
      .mockResolvedValueOnce(
        page([
          wireRow({
            id: 'appt_older0000000000000000',
            patient_id: PATIENT_ID,
            appointment_date: '2026-09-12',
            doctor_membership_id: DOCTOR_ARJUN.id,
          }),
        ]) as never,
      );

    const rows = await fetchPersonAppointments(CONTACT_ID);

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenNthCalledWith(1, '/app/appointments', {
      query: {
        contact_id: CONTACT_ID,
        sort: 'appointment_date',
        order: 'desc',
        limit: 100,
      },
    });
    expect(lastQuery()).toEqual({
      contact_id: CONTACT_ID,
      sort: 'appointment_date',
      order: 'desc',
      limit: 100,
      after: 'cursor-2',
    });
    expect(rows.map((row) => [row.id, row.date])).toEqual([
      [APPOINTMENT_ID, APPOINTMENT_TOMORROW],
      ['appt_older0000000000000000', '2026-09-12'],
    ]);
    expect(rows.map((row) => row.doctor?.name)).toEqual(['Nisha Shah', 'Arjun Rao']);
    expect(rows[0]?.person).toMatchObject({ kind: 'patient', patientId: PATIENT_ID });
    expect(fetchTeamDirectory).toHaveBeenCalledTimes(1);
  });

  it('stops at a page that says there is no more, whatever cursor it carries', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [wireRow()],
      meta: {
        request_id: 'req',
        pagination: { per_page: 100, next: 'stale', has_more: false },
      },
    } as never);

    expect(await fetchPersonAppointments(CONTACT_ID)).toEqual([appointmentRow()]);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('reads no team for a person with no bookings', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([]) as never);

    expect(await fetchPersonAppointments(CONTACT_ID)).toEqual([]);
    expect(fetchTeamDirectory).not.toHaveBeenCalled();
  });
});

describe('fetchAppointmentDayCounts (the Agenda’s day headers)', () => {
  /** A day's counts as clinozy-be answers them — every status, zeros included. */
  const countsWire = (date: string, counts: Record<string, number> = {}) => {
    const byStatus = {
      scheduled: 0,
      confirmed: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      ...counts,
    };
    return {
      appointment_date: date,
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      by_status: byStatus,
    };
  };

  it('reads each day’s counts for the doctor and the branches, every status', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        countsWire(APPOINTMENT_TODAY, { scheduled: 1, confirmed: 2 }),
        countsWire(APPOINTMENT_TOMORROW),
      ],
    } as never);

    const counts = await fetchAppointmentDayCounts({
      from: APPOINTMENT_TODAY,
      to: APPOINTMENT_TOMORROW,
      doctorId: DOCTOR_NISHA.id,
      branchIds: [TEST_BRANCH_ID, OTHER_BRANCH_ID],
    });

    expect(api.get).toHaveBeenCalledWith('/app/appointments/daily-counts', {
      query: {
        date_from: APPOINTMENT_TODAY,
        date_to: APPOINTMENT_TOMORROW,
        doctor_membership_id: DOCTOR_NISHA.id,
        branch_ids: `${TEST_BRANCH_ID},${OTHER_BRANCH_ID}`,
      },
    });
    expect(counts).toEqual([
      dayCount(APPOINTMENT_TODAY, { scheduled: 1, confirmed: 2 }),
      dayCount(APPOINTMENT_TOMORROW),
    ]);
  });

  it('counts a status the day leaves out as none', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        { appointment_date: APPOINTMENT_TODAY, total: 2, by_status: { confirmed: 2 } },
      ],
    } as never);

    const [today] = await fetchAppointmentDayCounts({
      from: APPOINTMENT_TODAY,
      to: APPOINTMENT_TODAY,
      branchIds: [],
    });

    expect(today).toEqual(dayCount(APPOINTMENT_TODAY, { confirmed: 2 }));
  });

  it('sends no doctor and no branch for everyone everywhere', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] } as never);

    await fetchAppointmentDayCounts({
      from: APPOINTMENT_TODAY,
      to: APPOINTMENT_TODAY,
      branchIds: [],
    });

    expect(lastQuery()).toEqual({
      date_from: APPOINTMENT_TODAY,
      date_to: APPOINTMENT_TODAY,
    });
  });
});

describe('fetchAppointment', () => {
  it('reads one booking by its id, with its doctor', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: wireRow() } as never);

    expect(await fetchAppointment(APPOINTMENT_ID)).toEqual(appointmentRow());
    expect(api.get).toHaveBeenCalledWith('/app/appointments/{appointment_id}', {
      params: { appointment_id: APPOINTMENT_ID },
    });
  });
});

describe('fetchAppointmentSlots (the slot grid)', () => {
  const params = {
    date: APPOINTMENT_TOMORROW,
    branchId: TEST_BRANCH_ID,
    doctorId: DOCTOR_NISHA.id,
    durationMin: 20,
    step: 30,
  } as const;

  it('asks for the day’s free starts for the doctor, branch, length and step', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        appointment_date: APPOINTMENT_TOMORROW,
        is_open: true,
        closed_reason: null,
        closed_label: null,
        slots: [
          { start_time: '10:00', end_time: '10:20' },
          { start_time: '11:30', end_time: '11:50' },
        ],
      },
    } as never);

    const day = await fetchAppointmentSlots(params);

    expect(api.get).toHaveBeenCalledWith('/app/appointments/slots', {
      query: {
        appointment_date: APPOINTMENT_TOMORROW,
        branch_id: TEST_BRANCH_ID,
        doctor_membership_id: DOCTOR_NISHA.id,
        duration_minutes: 20,
        step_minutes: 30,
      },
    });
    expect(day).toEqual(slotDay(APPOINTMENT_TOMORROW, ['10:00', '11:30']));
  });

  // WF-02: the booking being moved does not block its own starts.
  it('asks without the booking being moved — `exclude_appointment_id`', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        appointment_date: APPOINTMENT_TOMORROW,
        is_open: true,
        closed_reason: null,
        closed_label: null,
        slots: [],
      },
    } as never);

    await fetchAppointmentSlots({
      ...params,
      excludeAppointmentId: 'appt_moved00000000000000',
    });

    expect(api.get).toHaveBeenCalledWith('/app/appointments/slots', {
      query: expect.objectContaining({
        exclude_appointment_id: 'appt_moved00000000000000',
      }),
    });
  });

  // A booking's room and machine block a start as its doctor does (the save's exclusion checks).
  it('asks with the room and machine the booking holds', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        appointment_date: APPOINTMENT_TOMORROW,
        is_open: true,
        closed_reason: null,
        closed_label: null,
        slots: [],
      },
    } as never);

    await fetchAppointmentSlots({
      ...params,
      roomId: 'room_laser00000000000000',
      machineId: 'mach_diode00000000000000',
    });

    expect(api.get).toHaveBeenCalledWith('/app/appointments/slots', {
      query: expect.objectContaining({
        branch_room_id: 'room_laser00000000000000',
        branch_machine_id: 'mach_diode00000000000000',
      }),
    });
  });

  it('reads a closed day by its reason and a holiday’s name', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        appointment_date: APPOINTMENT_TOMORROW,
        is_open: false,
        closed_reason: 'holiday',
        closed_label: 'Diwali',
        slots: [],
      },
    } as never);

    expect(await fetchAppointmentSlots(params)).toEqual(
      slotDay(APPOINTMENT_TOMORROW, [], {
        closedReason: 'holiday',
        closedLabel: 'Diwali',
      }),
    );
  });
});

describe('bookableTreatmentsOf (the form’s "From offerings")', () => {
  it('takes the active treatments of the one catalogue, A to Z, with their length', () => {
    const catalogue = [
      offeringRecord({ id: 'off_peel0000000000000000', name: 'Peel', durationMin: 45 }),
      offeringRecord({
        id: 'off_hydra000000000000000',
        name: 'Hydrafacial',
        durationMin: 60,
        tone: 'mint',
      }),
      offeringRecord({ id: 'off_retired0000000000000', name: 'Glow', isActive: false }),
      offeringRecord({
        id: 'off_serum00000000000000',
        name: 'Serum',
        category: 'product',
      }),
    ];

    expect(bookableTreatmentsOf(catalogue)).toEqual([
      {
        id: 'off_hydra000000000000000',
        name: 'Hydrafacial',
        durationMin: 60,
        specialty: 'skin',
        tone: 'mint',
      },
      {
        id: 'off_peel0000000000000000',
        name: 'Peel',
        durationMin: 45,
        specialty: 'skin',
        tone: 'sage',
      },
    ]);
  });
});

describe('the writes', () => {
  it('books the contact with the fields the API’s way and the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: wireRow() } as never);

    const row = await createAppointment({
      input: {
        contactId: CONTACT_ID,
        branchId: TEST_BRANCH_ID,
        doctorId: DOCTOR_NISHA.id,
        type: 'treatment',
        offeringId: 'off_hydra000000000000000',
        serviceLabel: 'Hydrafacial',
        durationMin: 60,
        date: APPOINTMENT_TOMORROW,
        startTime: '10:30',
        reason: 'Dull skin',
        notes: null,
      },
      idempotencyKey: 'key-book',
    });

    expect(api.post).toHaveBeenCalledWith('/app/appointments', {
      body: {
        contact_id: CONTACT_ID,
        branch_id: TEST_BRANCH_ID,
        doctor_membership_id: DOCTOR_NISHA.id,
        type: 'treatment',
        offering_id: 'off_hydra000000000000000',
        service_label: 'Hydrafacial',
        duration_minutes: 60,
        appointment_date: APPOINTMENT_TOMORROW,
        start_time: '10:30',
        reason: 'Dull skin',
        notes: null,
      },
      idempotencyKey: 'key-book',
    });
    expect(row).toEqual(appointmentRow());
  });

  it('copies a booking onto a new day and start', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: wireRow({ copied_from_appointment_id: 'appt_first0000000000000000' }),
    } as never);

    const row = await copyAppointment({
      appointmentId: 'appt_first0000000000000000',
      date: APPOINTMENT_TOMORROW,
      startTime: '10:30',
      idempotencyKey: 'key-copy',
    });

    expect(api.post).toHaveBeenCalledWith('/app/appointments/{appointment_id}/copy', {
      params: { appointment_id: 'appt_first0000000000000000' },
      body: { appointment_date: APPOINTMENT_TOMORROW, start_time: '10:30' },
      idempotencyKey: 'key-copy',
    });
    expect(row.copiedFromId).toBe('appt_first0000000000000000');
  });

  it('changes only the fields given, with the read’s updated_at and the key', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: wireRow({ doctor_membership_id: DOCTOR_ARJUN.id, move_count: 1 }),
    } as never);

    const row = await updateAppointment({
      appointmentId: APPOINTMENT_ID,
      fields: {
        doctorId: DOCTOR_ARJUN.id,
        date: '2026-10-05',
        startTime: '11:00',
        reason: null,
      },
      expectedUpdatedAt: '2026-10-01T08:00:00.000Z',
      idempotencyKey: 'key-edit',
    });

    expect(api.patch).toHaveBeenCalledWith('/app/appointments/{appointment_id}', {
      params: { appointment_id: APPOINTMENT_ID },
      body: {
        doctor_membership_id: DOCTOR_ARJUN.id,
        appointment_date: '2026-10-05',
        start_time: '11:00',
        reason: null,
        expected_updated_at: '2026-10-01T08:00:00.000Z',
      },
      idempotencyKey: 'key-edit',
    });
    expect(row.doctor).toEqual(DOCTOR_ARJUN);
  });

  it.each<AppointmentMoveRoute>([
    'confirm',
    'check-in',
    'complete',
    'no-show',
    'reinstate',
    'undo-check-in',
  ])('moves the status through its own route — %s', async (route) => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: wireRow() } as never);

    const row = await moveAppointment({
      appointmentId: APPOINTMENT_ID,
      route,
      idempotencyKey: `key-${route}`,
    });

    expect(api.post).toHaveBeenCalledWith(`/app/appointments/{appointment_id}/${route}`, {
      params: { appointment_id: APPOINTMENT_ID },
      idempotencyKey: `key-${route}`,
    });
    expect(row.doctor).toEqual(DOCTOR_NISHA);
  });

  it('cancels with the API’s reason and the note', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: wireRow({ status: 'cancelled', cancel_reason: 'other', cancel_note: 'Away' }),
    } as never);

    const row = await cancelAppointment({
      appointmentId: APPOINTMENT_ID,
      cancel: { reason: 'other', note: 'Away' },
      idempotencyKey: 'key-cancel',
    });

    expect(api.post).toHaveBeenCalledWith('/app/appointments/{appointment_id}/cancel', {
      params: { appointment_id: APPOINTMENT_ID },
      body: { cancel_reason: 'other', cancel_note: 'Away' },
      idempotencyKey: 'key-cancel',
    });
    expect(row).toMatchObject({
      status: 'cancelled',
      cancelReason: 'other',
      cancelNote: 'Away',
    });
  });

  it('leaves the note out of a cancel without one', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: wireRow({ status: 'cancelled', cancel_reason: 'patient_asked' }),
    } as never);

    await cancelAppointment({
      appointmentId: APPOINTMENT_ID,
      cancel: { reason: 'patient_asked', note: null },
      idempotencyKey: 'key-cancel',
    });

    const init = vi.mocked(api.post).mock.lastCall?.[1] as {
      body: Record<string, unknown>;
    };
    expect(init.body).toEqual({ cancel_reason: 'patient_asked' });
    expect(init.body.cancel_note).toBeUndefined();
  });
});

describe('appointmentQueryKeys', () => {
  const range = { ...ACTIVE, from: APPOINTMENT_TODAY, to: APPOINTMENT_TOMORROW };
  const slots = {
    date: APPOINTMENT_TOMORROW,
    branchId: TEST_BRANCH_ID,
    doctorId: DOCTOR_NISHA.id,
    durationMin: 20,
    step: 30,
  } as const;

  it('keep every read under the organization’s prefix, so a write refreshes them all', () => {
    const prefix = [...appointmentQueryKeys.all, 'org_test'];
    for (const key of [
      appointmentQueryKeys.list('org_test', ACTIVE),
      appointmentQueryKeys.counts('org_test', {
        from: APPOINTMENT_TODAY,
        to: APPOINTMENT_TOMORROW,
        branchIds: [],
      }),
      appointmentQueryKeys.range('org_test', range),
      appointmentQueryKeys.detail('org_test', APPOINTMENT_ID),
      appointmentQueryKeys.slots('org_test', slots),
      appointmentQueryKeys.person('org_test', CONTACT_ID),
    ]) {
      expect(key.slice(0, 3)).toEqual(prefix);
    }
    expect(appointmentQueryKeys.list('org_test', ACTIVE).slice(0, 4)).toEqual(
      appointmentQueryKeys.lists('org_test'),
    );
    expect(appointmentQueryKeys.slots('org_test', slots).slice(0, 4)).toEqual(
      appointmentQueryKeys.slotDays('org_test'),
    );
  });

  it('carry the organization, so two never share a read', () => {
    expect(appointmentQueryKeys.detail('org_one', APPOINTMENT_ID)).not.toEqual(
      appointmentQueryKeys.detail('org_two', APPOINTMENT_ID),
    );
    expect(appointmentQueryKeys.person('org_one', CONTACT_ID)).not.toEqual(
      appointmentQueryKeys.person('org_two', CONTACT_ID),
    );
  });
});
