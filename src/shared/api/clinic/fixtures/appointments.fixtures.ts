import type { AppointmentRecord } from '@/shared/api/clinic/appointments-contracts.ts';
import {
  PROTOTYPE_SEED_DAY,
  seedCommon,
  seedDate,
  seedInstant,
} from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type {
  AppointmentStatus,
  AppointmentType,
  DeliveryStatus,
  Room,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import { contactThreadRef } from './leads.fixtures.ts';
import { branchRef, MAIN_BRANCH } from './organization.fixtures.ts';
import { findPatientRef } from './patients.fixtures.ts';
import { bookedOn, must, ref, secondsLater, seedAt } from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

/** Service labels (`AP_SVC` H:3416 and Today's cards) as the contract's appointment type. */
const TYPES: Record<string, AppointmentType> = {
  Consultation: 'consultation',
  'Melasma consult': 'consultation',
  'Follow-up': 'follow_up',
  'Review consult': 'follow_up',
  'Follow-up consult': 'follow_up',
  Treatment: 'treatment',
  'LHR Treatment': 'treatment',
  Peel: 'treatment',
  Hydrafacial: 'treatment',
  'Laser hair reduction': 'treatment',
  'Chemical peel + consult': 'treatment',
  Other: 'other',
};
const STATUSES: Record<string, AppointmentStatus> = {
  Scheduled: 'scheduled',
  Confirmed: 'confirmed',
  'Checked in': 'checked_in',
  Completed: 'completed',
  Cancelled: 'cancelled',
  'No show': 'no_show',
};

interface AppointmentRow {
  seq: number;
  /** The person, by name: a patient when the roster has them, else their contact thread. */
  who: string;
  /** Prototype calendar date. */
  date: string;
  time: string;
  minutes: number;
  service: string;
  doctor: StaffKey;
  status: string;
  /** `fu`, "YYYY-MM-DD HH:mm". */
  followUp?: string;
  /** "Moved · was …" (`movedFrom`). */
  movedFrom?: string;
  /** Confirmed by a WhatsApp "Yes" (`auto`). */
  repliedYes?: boolean;
  room?: Room;
}

const TODAY = PROTOTYPE_SEED_DAY;

/**
 * `AP_INIT` (H:3426–3445), verbatim. #2847 is also Today's "Hydrafacial · Room
 * 2" card; the record keeps AP_INIT's "Checked in" where the card says
 * "Confirmed".
 */
const BOOKINGS: readonly AppointmentRow[] = [
  {
    seq: 2841,
    who: 'Meera Joshi',
    date: '2026-09-26',
    time: '12:00',
    minutes: 45,
    service: 'Hydrafacial',
    doctor: 'DR',
    status: 'Completed',
  },
  {
    seq: 2843,
    who: 'Dhruv Patel',
    date: '2026-09-26',
    time: '16:30',
    minutes: 60,
    service: 'LHR Treatment',
    doctor: 'DD',
    status: 'Completed',
  },
  {
    seq: 2838,
    who: 'Kinjal Vora',
    date: '2026-09-25',
    time: '11:30',
    minutes: 30,
    service: 'Peel',
    doctor: 'DN',
    status: 'No show',
  },
  {
    seq: 2858,
    who: 'Jalpa Sheladiya',
    date: '2026-09-28',
    time: '10:30',
    minutes: 20,
    service: 'Treatment',
    doctor: 'DD',
    status: 'Confirmed',
    followUp: '2026-09-26 17:26',
  },
  {
    seq: 2857,
    who: 'Ridhi Delvadiya',
    date: '2026-09-28',
    time: '15:30',
    minutes: 60,
    service: 'Treatment',
    doctor: 'DD',
    status: 'Scheduled',
    followUp: '2026-09-26 14:42',
  },
  {
    seq: 2855,
    who: 'Sandip Jivani',
    date: '2026-09-30',
    time: '12:00',
    minutes: 60,
    service: 'Treatment',
    doctor: 'DD',
    status: 'Scheduled',
    followUp: '2026-09-28 16:00',
  },
  {
    seq: 2850,
    who: 'Gaytri Jagani',
    date: '2026-10-01',
    time: '10:30',
    minutes: 90,
    service: 'LHR Treatment',
    doctor: 'DD',
    status: 'Scheduled',
    followUp: '2026-09-30 16:00',
  },
  {
    seq: 2853,
    who: 'Apeksha Patel',
    date: '2026-10-02',
    time: '10:30',
    minutes: 60,
    service: 'LHR Treatment',
    doctor: 'DN',
    status: 'Scheduled',
    followUp: '2026-10-01 16:00',
  },
  {
    seq: 2849,
    who: 'Dayaben Savaliya',
    date: '2026-10-02',
    time: '10:00',
    minutes: 30,
    service: 'Consultation',
    doctor: 'DD',
    status: 'Scheduled',
    followUp: '2026-10-01 16:00',
  },
  {
    seq: 2854,
    who: 'Komal Sonani',
    date: '2026-10-07',
    time: '10:00',
    minutes: 20,
    service: 'Consultation',
    doctor: 'DD',
    status: 'Scheduled',
    followUp: '2026-10-06 16:00',
  },
  {
    seq: 2856,
    who: 'Honey Shingala',
    date: '2026-10-08',
    time: '10:00',
    minutes: 30,
    service: 'Consultation',
    doctor: 'DD',
    status: 'Scheduled',
    followUp: '2026-10-07 16:00',
  },
  {
    seq: 2859,
    who: 'Dharti Galani',
    date: '2026-10-08',
    time: '11:00',
    minutes: 30,
    service: 'Peel',
    doctor: 'DN',
    status: 'Confirmed',
  },
  {
    seq: 2852,
    who: 'Nidhi Dhingani',
    date: '2026-10-26',
    time: '10:00',
    minutes: 60,
    service: 'Treatment',
    doctor: 'DD',
    status: 'Scheduled',
    followUp: '2026-10-24 16:00',
  },
  {
    seq: 2780,
    who: 'Rhea Shah',
    date: '2026-08-12',
    time: '16:00',
    minutes: 60,
    service: 'LHR Treatment',
    doctor: 'DR',
    status: 'Completed',
  },
  {
    seq: 2861,
    who: 'Rhea Shah',
    date: '2026-10-03',
    time: '16:00',
    minutes: 60,
    service: 'LHR Treatment',
    doctor: 'DR',
    status: 'Confirmed',
    followUp: '2026-10-02 16:00',
    movedFrom: '1 Oct 4:00 pm',
    repliedYes: true,
  },
  {
    seq: 2740,
    who: 'Dharti Galani',
    date: '2026-09-24',
    time: '14:50',
    minutes: 30,
    service: 'Peel',
    doctor: 'DN',
    status: 'Completed',
  },
  {
    seq: 2848,
    who: 'Priti Soni',
    date: TODAY,
    time: '11:30',
    minutes: 30,
    service: 'LHR Treatment',
    doctor: 'DR',
    status: 'Scheduled',
  },
  {
    seq: 2847,
    who: 'Meera Joshi',
    date: TODAY,
    time: '11:00',
    minutes: 45,
    service: 'Hydrafacial',
    doctor: 'DR',
    status: 'Checked in',
    room: 'room_2',
  },
];

/**
 * The patient file's visits (`PT_AP` H:3687) that AP_INIT lacks: #2790 (the
 * consultation the plan, check-in and review seeds point at) and #2702. Its
 * #2847 for Dharti repeats Meera's id and slot, so it is dropped.
 */
const FILE_VISITS: readonly AppointmentRow[] = [
  {
    seq: 2790,
    who: 'Dharti Galani',
    date: '2026-09-24',
    time: '14:50',
    minutes: 20,
    service: 'Consultation',
    doctor: 'DD',
    status: 'Completed',
  },
  {
    seq: 2702,
    who: 'Varun Bhimani',
    date: '2026-08-18',
    time: '17:48',
    minutes: 20,
    service: 'Consultation',
    doctor: 'DN',
    status: 'Completed',
  },
];

/**
 * Today's floor (`CARDS` H:3447–3458) as the bookings it implies — the plan
 * derives Today from today's appointments — plus the `TASKS` no-show (H:3462).
 * In-clinic stages are `checked_in`; the pharmacy card's visit is `completed`.
 * Doctors are the cards' ("Dr. Mavani" is DN, "Dr. Shah" KS, "Kiran" KP);
 * lengths are the service defaults (`AP_SVC` / `AP_TYPE` H:3416–3418). Seqs
 * follow AP_INIT's last (#2861), in time order.
 */
const FLOOR_VISITS: readonly AppointmentRow[] = [
  {
    seq: 2862,
    who: 'Vikram Bhatt',
    date: TODAY,
    time: '09:30',
    minutes: 20,
    service: 'Consultation',
    doctor: 'DN',
    status: 'No show',
  },
  {
    seq: 2863,
    who: 'Harsh Trivedi',
    date: TODAY,
    time: '09:40',
    minutes: 20,
    service: 'Consultation',
    doctor: 'DN',
    status: 'Completed',
  },
  {
    seq: 2864,
    who: 'Ishita Vora',
    date: TODAY,
    time: '09:50',
    minutes: 30,
    service: 'Chemical peel + consult',
    doctor: 'DN',
    status: 'Checked in',
  },
  {
    seq: 2865,
    who: 'Dhruv Patel',
    date: TODAY,
    time: '10:15',
    minutes: 60,
    service: 'Laser hair reduction',
    doctor: 'KP',
    status: 'Checked in',
  },
  {
    seq: 2866,
    who: 'Sana Kapoor',
    date: TODAY,
    time: '10:20',
    minutes: 20,
    service: 'Melasma consult',
    doctor: 'DN',
    status: 'Checked in',
  },
  {
    seq: 2867,
    who: 'Rhea Shah',
    date: TODAY,
    time: '10:40',
    minutes: 15,
    service: 'Review consult',
    doctor: 'DN',
    status: 'Checked in',
  },
  {
    seq: 2868,
    who: 'Nikhil Rao',
    date: TODAY,
    time: '10:45',
    minutes: 15,
    service: 'Follow-up consult',
    doctor: 'KS',
    status: 'Checked in',
  },
  {
    seq: 2869,
    who: 'Faizan Shaikh',
    date: TODAY,
    time: '11:15',
    minutes: 20,
    service: 'Consultation',
    doctor: 'DN',
    status: 'Confirmed',
  },
];

const ARRIVED: ReadonlySet<AppointmentStatus> = new Set(['checked_in', 'completed']);

/** The prototype's reminder states by id (`MS`, H:5909); "none" is no message yet. */
const REMINDER_CYCLE: readonly DeliveryStatus[] = ['read', 'delivered', 'sent'];

/**
 * The reminder's delivery state ("Latest update" — server data the prototype
 * synthesises from the id, H:5909–5913; REPLACE_WITH_API): a Scheduled
 * booking has none yet, or a failed one; the rest cycle read, delivered, sent.
 */
function reminderOf(seq: number, status: AppointmentStatus): DeliveryStatus | null {
  if (status === 'scheduled') return seq % 4 === 3 ? 'failed' : null;
  return REMINDER_CYCLE[seq % REMINDER_CYCLE.length] ?? null;
}

/**
 * Every booking: AP_INIT, the file's visits, then today's floor — with the
 * plan's fields (Appendix F): the reminder's state, a WhatsApp "Yes" (#2861's
 * `auto`), the moves (`moved`) and no package session.
 */
export function appointmentSeed(today: string = clinicToday()): AppointmentRecord[] {
  return [...BOOKINGS, ...FILE_VISITS, ...FLOOR_VISITS].map((row) => {
    const status = must(STATUSES[row.status], `appointment status ${row.status}`);
    const start = seedInstant(row.date, row.time, today);
    const checkedInAt = ARRIVED.has(status) ? secondsLater(start, -300) : null;
    const completedAt =
      status === 'completed' ? secondsLater(start, row.minutes * 60) : null;
    const createdAt = seedInstant(bookedOn(row.date), '10:00', today);
    const patientId = findPatientRef(row.who) ?? null;
    return {
      ...seedCommon(createdAt, staffRef('RS'), completedAt ?? checkedInAt ?? createdAt),
      id: ref.appointment(row.seq),
      seq: row.seq,
      patientId,
      leadId: patientId ? null : contactThreadRef(row.who),
      branchId: branchRef(MAIN_BRANCH),
      type: must(TYPES[row.service], `service ${row.service}`),
      offeringId: null,
      serviceLabel: row.service,
      doctorId: staffRef(row.doctor),
      therapistId: null,
      room: row.room ?? null,
      date: seedDate(row.date, today),
      startTime: row.time,
      durationMin: row.minutes,
      status,
      cancelReason: null,
      cancelNote: null,
      rescheduledFrom: row.movedFrom ? seedAt(row.movedFrom, '10:00', today) : null,
      reason: null,
      notes: null,
      followUpAt: row.followUp ? seedAt(row.followUp, '10:00', today) : null,
      checkedInAt,
      completedAt,
      copiedFromId: null,
      reminder: reminderOf(row.seq, status),
      repliedYes: row.repliedYes ?? false,
      moveCount: row.movedFrom ? 1 : 0,
      patientPackageId: null,
    };
  });
}
