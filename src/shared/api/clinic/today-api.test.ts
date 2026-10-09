import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('./directory-api.ts', () => ({
  fetchMemberNames: vi.fn(),
  fetchRoomNames: vi.fn(),
}));
import { api } from '@/core/http/api.ts';

import { appointmentQueryKeys } from './appointments-api.ts';
import { clinicInstant } from './clinic-time.ts';
import { fetchMemberNames, fetchRoomNames } from './directory-api.ts';
import { leadQueryKeys } from './leads-api.ts';
import {
  checkInAppointment,
  fetchTodayEnquiries,
  fetchTodayFloor,
  moveFloorStage,
  normalizeTodayFloorParams,
  todayQueryKeys,
  undoCheckIn,
} from './today-api.ts';

/** The seed day, 10:42 on the clinic clock. */
const TODAY = '2026-10-03';

const page = (rows: unknown[], next: string | null = null) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 100, next, has_more: next !== null },
  },
});

const appointment = (n: number, patch: Record<string, unknown> = {}) => ({
  id: `appt_${n}`,
  appointment_number: n,
  contact_id: `con_${n}`,
  contact: { first_name: `Person ${n}`, last_name: null, primary_phone: '+919800000000' },
  patient_id: null,
  lead_id: null,
  branch_id: 'brn_main',
  type: 'consultation',
  service_label: 'Consultation',
  doctor_membership_id: 'mem_doc',
  branch_room_id: null,
  start_time: '11:00',
  status: 'confirmed',
  visit_stage: null,
  visit_stage_changed_at: null,
  checked_in_at: null,
  is_walk_in: false,
  updated_at: '2026-10-03T04:00:00.000Z',
  ...patch,
});

const lead = (n: number, lastActivityAt: string | null) => ({
  id: `lead_${n}`,
  lead_number: n,
  contact: { first_name: `Lead ${n}`, last_name: null },
  status: 'new',
  source: 'whatsapp',
  interests: ['clinical'],
  last_activity_at: lastActivityAt,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:42')));
  vi.mocked(fetchMemberNames).mockResolvedValue(new Map([['mem_doc', 'Dr. Nisha']]));
  vi.mocked(fetchRoomNames).mockResolvedValue(new Map([['room_2', 'Room 2']]));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('today query keys', () => {
  it('fill the day and order the branches, so equal reads share one entry', () => {
    expect(normalizeTodayFloorParams({ branchIds: ['brn_b', 'brn_a', 'brn_b'] })).toEqual(
      {
        date: TODAY,
        branchIds: ['brn_a', 'brn_b'],
      },
    );
  });

  it('sit under the appointments and leads prefixes — their writes refresh the floor', () => {
    expect(todayQueryKeys.floor('org_1').slice(0, 2)).toEqual([
      ...appointmentQueryKeys.all,
    ]);
    expect(todayQueryKeys.enquiries('org_1').slice(0, 2)).toEqual([...leadQueryKeys.all]);
  });

  it('carry the organization, so two never share a floor', () => {
    expect(todayQueryKeys.floor('org_1')).not.toEqual(todayQueryKeys.floor('org_2'));
    expect(todayQueryKeys.enquiries('org_1')).toContain('org_1');
  });
});

describe('fetchTodayFloor', () => {
  it('reads every page of the day’s open bookings in the branches, with the names joined', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([appointment(1)], 'cursor-2') as never)
      .mockResolvedValueOnce(
        page([appointment(2, { branch_room_id: 'room_2' })]) as never,
      );

    const rows = await fetchTodayFloor({ branchIds: ['brn_main', 'brn_b'] });

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/appointments', {
      query: {
        limit: 100,
        after: undefined,
        appointment_date_from: TODAY,
        appointment_date_to: TODAY,
        branch_ids: 'brn_b,brn_main',
        status: 'scheduled,confirmed,checked_in',
        sort: 'appointment_date',
        order: 'asc',
      },
    });
    expect(vi.mocked(api.get).mock.calls[1]?.[1]).toMatchObject({
      query: { after: 'cursor-2' },
    });
    expect(fetchMemberNames).toHaveBeenCalledWith(['mem_doc', 'mem_doc']);
    expect(fetchRoomNames).toHaveBeenCalledWith('brn_main');
    expect(rows.map((row) => [row.id, row.doctorName, row.roomName])).toEqual([
      ['appt_1', 'Dr. Nisha', null],
      ['appt_2', 'Dr. Nisha', 'Room 2'],
    ]);
    // No visit at the pharmacy: the pharmacy queue is not read.
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('sends no branch filter for every branch', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([]) as never);
    await fetchTodayFloor();
    expect(vi.mocked(api.get).mock.calls[0]?.[1]).toMatchObject({
      query: { branch_ids: undefined },
    });
  });

  it('joins the day’s approved Rx still to fill to a pharmacy card, for a member who reads it', async () => {
    const atPharmacy = appointment(3, {
      status: 'checked_in',
      visit_stage: 'pharmacy',
      visit_stage_changed_at: '2026-10-03T05:00:00.000Z',
      checked_in_at: '2026-10-03T04:00:00.000Z',
    });
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([atPharmacy]) as never)
      .mockResolvedValueOnce(
        page([
          {
            id: 'rx_1',
            patient_id: 'pat_1',
            appointment_id: 'appt_3',
            items: [
              { medicine_name: 'A' },
              { medicine_name: 'B' },
              { medicine_name: 'C' },
            ],
            approved_at: '2026-10-03T04:55:00.000Z',
          },
        ]) as never,
      );

    const [row] = await fetchTodayFloor({}, { readsPrescriptions: true });

    expect(api.get).toHaveBeenLastCalledWith('/app/patient-prescriptions', {
      query: {
        limit: 100,
        after: undefined,
        status: 'approved',
        is_filled: 'false',
        prescription_date_from: TODAY,
        prescription_date_to: TODAY,
      },
    });
    expect(row?.prescription).toEqual({
      id: 'rx_1',
      patientId: 'pat_1',
      approvedAt: '2026-10-03T04:55:00.000Z',
      items: 3,
    });
  });

  it('leaves the pharmacy queue alone for a member who cannot read it', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([appointment(3, { status: 'checked_in', visit_stage: 'pharmacy' })]) as never,
    );
    const [row] = await fetchTodayFloor();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(row?.prescription).toBeNull();
  });
});

describe('fetchTodayEnquiries', () => {
  it('reads the awaiting enquiries newest first and stops at the first one from before today', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page(
        [
          lead(2, '2026-10-03T05:01:00.000Z'),
          lead(1, '2026-10-02T12:00:00.000Z'),
          lead(0, '2026-10-03T04:00:00.000Z'),
        ],
        'cursor-2',
      ) as never,
    );

    const enquiries = await fetchTodayEnquiries({ branchIds: ['brn_main'] });

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/app/leads', {
      query: {
        limit: 100,
        after: undefined,
        kind: 'enquiry',
        status: 'new,contacted,follow_up,no_response',
        is_awaiting_reply: 'true',
        branch_ids: 'brn_main',
        sort: 'last_activity_at',
        order: 'desc',
      },
    });
    expect(enquiries.map((enquiry) => enquiry.id)).toEqual(['lead_2']);
  });

  it('follows the pages while every row is today’s', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        page([lead(2, '2026-10-03T05:01:00.000Z')], 'cursor-2') as never,
      )
      .mockResolvedValueOnce(page([lead(1, '2026-10-03T04:01:00.000Z')]) as never);

    const enquiries = await fetchTodayEnquiries();

    expect(enquiries.map((enquiry) => enquiry.id)).toEqual(['lead_2', 'lead_1']);
    expect(vi.mocked(api.get).mock.calls[1]?.[1]).toMatchObject({
      query: { after: 'cursor-2' },
    });
  });
});

describe('the moves', () => {
  it('check in, undo it and move a stage on the booking, each with its action’s key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);

    await checkInAppointment({ appointmentId: 'appt_1', idempotencyKey: 'key-1' });
    await undoCheckIn({ appointmentId: 'appt_1', idempotencyKey: 'key-2' });
    await moveFloorStage({
      appointmentId: 'appt_1',
      stage: 'with_doctor',
      idempotencyKey: 'key-3',
    });

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/app/appointments/{appointment_id}/check-in',
      { params: { appointment_id: 'appt_1' }, idempotencyKey: 'key-1' },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/app/appointments/{appointment_id}/undo-check-in',
      { params: { appointment_id: 'appt_1' }, idempotencyKey: 'key-2' },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      '/app/appointments/{appointment_id}/stage',
      {
        params: { appointment_id: 'appt_1' },
        body: { visit_stage: 'with_doctor' },
        idempotencyKey: 'key-3',
      },
    );
  });
});
