import type { TodayEnquiry, TodayFloorRow } from '@/shared/api/clinic/today-contracts.ts';

/** A stable uuid for the tests' rows (`n` picks it). */
export const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** One floor row — a confirmed booking at 11:00 today, for a returning patient — with `patch` over it. */
export function floorRow(patch: Partial<TodayFloorRow> = {}): TodayFloorRow {
  return {
    organizationId: uuid(900),
    createdAt: '2026-10-01T04:30:00.000Z',
    updatedAt: '2026-10-01T04:30:00.000Z',
    createdById: uuid(901),
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
    id: uuid(1),
    seq: 2847,
    patientId: uuid(2),
    leadId: null,
    branchId: uuid(3),
    type: 'treatment',
    offeringId: null,
    serviceLabel: 'Hydrafacial',
    doctorId: uuid(4),
    therapistId: null,
    room: null,
    date: '2026-10-03',
    startTime: '11:00',
    durationMin: 45,
    status: 'confirmed',
    cancelReason: null,
    cancelNote: null,
    rescheduledFrom: null,
    reason: null,
    notes: null,
    followUpAt: null,
    checkedInAt: null,
    completedAt: null,
    copiedFromId: null,
    reminder: null,
    repliedYes: false,
    moveCount: 0,
    patientPackageId: null,
    person: {
      kind: 'patient',
      name: 'Meera Joshi',
      phone: '+919824055123',
      patientId: uuid(2),
      leadId: null,
      seq: 3501,
    },
    doctor: {
      id: uuid(4),
      firstName: 'Dr. Nisha',
      lastName: 'Mavani',
      initials: 'NM',
      tone: 'sky',
      roles: ['doctor'],
      presence: 'online',
      active: true,
    },
    plan: { visit: 0, patient: 0 },
    visit: null,
    firstVisit: false,
    dueTotal: 0,
    toPay: 0,
    pack: null,
    prescription: null,
    allergies: [],
    ...patch,
  };
}

/** One open enquiry — a new WhatsApp lead who wrote at 10:31 (IST) — with `patch` over it. */
export function enquiry(patch: Partial<TodayEnquiry> = {}): TodayEnquiry {
  return {
    id: uuid(50),
    seq: 2363,
    name: 'Anaya Desai',
    status: 'new',
    source: 'whatsapp',
    interests: ['clinical'],
    askedAt: '2026-10-03T05:01:00.000Z',
    message: 'Is Saturday possible?',
    ...patch,
  };
}
