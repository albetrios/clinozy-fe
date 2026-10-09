import type {
  FloorStage,
  TodayEnquiry,
  TodayFloorRow,
} from '@/shared/api/clinic/today-contracts.ts';

/** A public id for the tests' rows: `<prefix>_` and `n` padded to the API's 21 characters. */
export const publicId = (prefix: string, n: number) =>
  `${prefix}_${String(n).padStart(21, '0')}`;

/** One floor row — a confirmed booking at 11:00 today, for a returning patient — with `patch` over it. */
export function floorRow(patch: Partial<TodayFloorRow> = {}): TodayFloorRow {
  return {
    id: publicId('appt', 1),
    appointmentNumber: 2847,
    contactId: publicId('con', 1),
    name: 'Meera Joshi',
    phone: '+919824055123',
    patientId: publicId('pat', 2),
    leadId: null,
    branchId: publicId('brn', 3),
    type: 'treatment',
    serviceLabel: 'Hydrafacial',
    doctorMembershipId: publicId('mem', 4),
    doctorName: 'Dr. Nisha Mavani',
    roomName: null,
    startTime: '11:00',
    status: 'confirmed',
    visitStage: null,
    visitStageChangedAt: null,
    checkedInAt: null,
    isWalkIn: false,
    updatedAt: '2026-10-01T04:30:00.000Z',
    prescription: null,
    ...patch,
  };
}

/** One open enquiry — a new WhatsApp lead active at 10:31 (IST) — with `patch` over it. */
export function enquiry(patch: Partial<TodayEnquiry> = {}): TodayEnquiry {
  return {
    id: publicId('lead', 50),
    leadNumber: 2363,
    name: 'Anaya Desai',
    status: 'new',
    source: 'whatsapp',
    interests: ['clinical'],
    lastActivityAt: '2026-10-03T05:01:00.000Z',
    ...patch,
  };
}

/** A checked-in row at `stage`, in the room since `since` (an instant). */
const checkedIn = (stage: FloorStage, since: string): Partial<TodayFloorRow> => ({
  status: 'checked_in',
  visitStage: stage,
  visitStageChangedAt: since,
  checkedInAt: since,
});

/**
 * The seed day's floor (2026-10-03, the clinic clock at 10:42): two enquiries, two arriving,
 * three waiting and one in each later lane — the counts the room test reads.
 */
export function seededFloor(): { rows: TodayFloorRow[]; enquiries: TodayEnquiry[] } {
  return {
    rows: [
      floorRow({
        id: publicId('appt', 11),
        name: 'Faizan Shaikh',
        patientId: null,
        leadId: null,
        startTime: '11:30',
        status: 'scheduled',
        type: 'consultation',
        serviceLabel: 'Consultation',
      }),
      floorRow({
        id: publicId('appt', 12),
        name: 'Priti Soni',
        patientId: publicId('pat', 3511),
        startTime: '12:00',
      }),
      floorRow({
        id: publicId('appt', 13),
        name: 'Rhea Shah',
        startTime: '10:00',
        ...checkedIn('waiting', '2026-10-03T04:35:00.000Z'),
      }),
      floorRow({
        id: publicId('appt', 14),
        name: 'Kavya Mehta',
        startTime: '10:15',
        ...checkedIn('waiting', '2026-10-03T04:50:00.000Z'),
      }),
      floorRow({
        id: publicId('appt', 15),
        name: 'Aarav Jain',
        startTime: '10:30',
        ...checkedIn('waiting', '2026-10-03T05:00:00.000Z'),
      }),
      floorRow({
        id: publicId('appt', 16),
        name: 'Sana Kapoor',
        startTime: '09:45',
        ...checkedIn('with_doctor', '2026-10-03T04:55:00.000Z'),
      }),
      floorRow({
        id: publicId('appt', 17),
        name: 'Dhruv Patel',
        startTime: '09:30',
        roomName: 'Room 2',
        ...checkedIn('treatment', '2026-10-03T04:40:00.000Z'),
      }),
      floorRow({
        id: publicId('appt', 18),
        name: 'Nidhi Rao',
        patientId: publicId('pat', 2864),
        startTime: '09:00',
        ...checkedIn('checkout', '2026-10-03T05:05:00.000Z'),
      }),
      floorRow({
        id: publicId('appt', 19),
        name: 'Harsh Trivedi',
        startTime: '08:45',
        ...checkedIn('pharmacy', '2026-10-03T05:00:00.000Z'),
        prescription: {
          id: publicId('rx', 501),
          patientId: publicId('pat', 2),
          approvedAt: '2026-10-03T04:35:00.000Z',
          items: 3,
        },
      }),
    ],
    enquiries: [
      enquiry({
        id: publicId('lead', 2364),
        leadNumber: 2364,
        name: 'Ishaan Verma',
        lastActivityAt: '2026-10-03T04:50:00.000Z',
      }),
      enquiry({
        id: publicId('lead', 2363),
        leadNumber: 2363,
        lastActivityAt: '2026-10-03T05:01:00.000Z',
      }),
    ],
  };
}
