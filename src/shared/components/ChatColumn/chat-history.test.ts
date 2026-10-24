import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import type { LeadMessage } from '@/shared/api/app/app-schema.ts';
import { appClockTime, appToday, localDateOf } from '@/shared/api/app/app-time.ts';
import { patientRef } from '@/shared/api/app/fixtures/patients.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';
import { fetchContactHistory } from '@/shared/api/app/messages-api.ts';
import type { ContactHistoryEntry } from '@/shared/api/app/messages-contracts.ts';
import { appClockOf } from '@/shared/hooks/useAppClock/index.ts';
import {
  Calendar,
  CheckCircle,
  MessageSquare,
  Pill,
  Receipt,
  Sparkles,
  Star,
  Wallet,
  WhatsAppMark,
} from '@/shared/icons/index.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { CHAT_COLUMN_NS } from './chat-column.constants.ts';
import {
  type ChatClock,
  type ChatFormat,
  chatWhenLabel,
  historyChip,
  historyText,
  threadDivider,
  threadEntries,
} from './chat-history.ts';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "9 Oct", "28 Sep 2025" — as the design writes a date. */
const dateOf = (date: string) => {
  const [year, month = 1, day] = date.split('-').map(Number);
  return year === 2026
    ? `${day} ${MONTHS[month - 1]}`
    : `${day} ${MONTHS[month - 1]} ${year}`;
};
const weekdayOf = (date: string) => WEEKDAYS[localDateOf(date).getDay()] ?? '';

/**
 * The clinic's clock on Saturday 3 Oct 2026 — the rooms' one time rule over
 * parts that format as the design writes them (12-hour, lowercase).
 */
const clock: ChatClock = appClockOf(
  {
    today: '2026-10-03',
    appToday: '2026-10-03',
    dayOf: (instant) => appToday(new Date(instant)),
    time: (instant) => {
      const [hour = 0, minute = 0] = appClockTime(new Date(instant))
        .split(':')
        .map(Number);
      const meridiem = hour < 12 ? 'am' : 'pm';
      return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${meridiem}`;
    },
    shortTime: (instant) => {
      const [hour = 0, minute = 0] = appClockTime(new Date(instant))
        .split(':')
        .map(Number);
      const meridiem = hour < 12 ? 'am' : 'pm';
      const minutes = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
      return `${hour % 12 || 12}${minutes} ${meridiem}`;
    },
    date: dateOf,
    wallTime: (_date, time) => time,
  },
  {
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    weekday: weekdayOf,
    todayTime: (time) => `Today ${time}`,
    dayTime: (day, time) => `${day} ${time}`,
  },
);

function formatWith(maskMoney = false): ChatFormat {
  return {
    t: i18n.getFixedT('en', CHAT_COLUMN_NS),
    money: (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`,
    clock,
    maskMoney,
  };
}

const ID = '00000000-0000-4000-8000-000000000001';
const PATIENT = '00000000-0000-4000-8000-000000000002';
const at = (instant: string) => ({
  when: { kind: 'instant', at: instant } as const,
  sortAt: instant,
});
const day = (date: string) => ({
  when: { kind: 'day', date } as const,
  sortAt: `${date}T03:30:00.000Z`,
});

/** Every space as a plain one — a time's own is unbreakable (`U+00A0`). */
const plain = (value: string) => value.replace(/\u00a0/gu, ' ');

/** A line's words and order as read — its parts' isolate marks have their own test. */
const text = (entry: ContactHistoryEntry, maskMoney = false) =>
  plain(withoutBidiMarks(historyText(entry, formatWith(maskMoney))));

describe('chat times — the rooms’ one time rule', () => {
  it.each([
    [{ kind: 'instant', at: '2026-10-03T10:30:00.000Z' }, 'Today 4:00 pm'],
    [{ kind: 'instant', at: '2026-10-02T03:40:00.000Z' }, 'Yesterday 9:10 am'],
    [{ kind: 'instant', at: '2026-09-30T10:30:00.000Z' }, 'Wed 4:00 pm'],
    [{ kind: 'instant', at: '2026-09-20T10:30:00.000Z' }, '20 Sep 4:00 pm'],
    [{ kind: 'instant', at: '2026-10-04T05:30:00.000Z' }, 'Tomorrow 11:00 am'],
    [{ kind: 'instant', at: '2026-10-09T10:30:00.000Z' }, '9 Oct 4:00 pm'],
    [{ kind: 'day', date: '2026-10-03' }, 'Today'],
    [{ kind: 'day', date: '2026-10-02' }, 'Yesterday'],
    [{ kind: 'day', date: '2026-09-29' }, 'Tue'],
    [{ kind: 'day', date: '2026-10-04' }, 'Tomorrow'],
    [{ kind: 'day', date: '2026-10-09' }, '9 Oct'],
    [{ kind: 'day', date: '2025-09-28' }, '28 Sep 2025'],
  ] as const)('reads %j as "%s"', (when, label) => {
    expect(plain(chatWhenLabel(when, clock))).toBe(label);
  });

  it('keeps a 12-hour time in one piece: no line break inside "4:00 pm"', () => {
    expect(
      chatWhenLabel({ kind: 'instant', at: '2026-10-02T10:30:00.000Z' }, clock),
    ).toBe('Yesterday 4:00\u00a0pm');
  });

  it('reads the day in the clinic’s zone — 11:30 pm IST is still today', () => {
    expect(
      plain(chatWhenLabel({ kind: 'instant', at: '2026-10-03T18:00:00.000Z' }, clock)),
    ).toBe('Today 11:30 pm');
  });
});

describe('contact-history strings (_patterns.md:184–192)', () => {
  it('names an appointment by id, service, status and doctor', () => {
    const entry: ContactHistoryEntry = {
      kind: 'appointment',
      id: ID,
      ...at('2026-09-30T09:20:00.000Z'),
      seq: 2740,
      service: 'Peel',
      status: 'completed',
      doctorName: 'Dr. Nisha Mavani',
    };
    expect(text(entry)).toBe('Appointment #2740 · Peel · Completed · Dr. Nisha');
    expect(historyChip(entry, formatWith())).toEqual({
      key: `appointment:${ID}`,
      // Each part isolated: "Dr. Nisha" keeps its full stop on a right-to-left page.
      text: [
        fsi('Appointment #2740'),
        fsi('Peel'),
        fsi('Completed'),
        fsi('Dr. Nisha'),
      ].join(' · '),
      icon: Calendar,
      tone: 'sage',
      target: { kind: 'appointment', appointmentId: ID },
    });
    expect(text({ ...entry, status: 'scheduled', doctorName: null })).toBe(
      'Appointment #2740 · Peel · Scheduled',
    );
    expect(historyChip({ ...entry, status: 'no_show' }, formatWith()).tone).toBe('blush');
  });

  it('says when a reminder went out for which visit — not clickable', () => {
    const entry: ContactHistoryEntry = {
      kind: 'reminder',
      id: ID,
      ...at('2026-10-03T05:00:00.000Z'),
      service: 'Treatment',
      visitAt: '2026-10-04T05:00:00.000Z',
    };
    expect(text(entry)).toBe('Reminder sent · Treatment · Tomorrow 10:30 am');
    expect(historyChip(entry, formatWith())).toMatchObject({
      icon: WhatsAppMark,
      tone: 'sage',
      target: null,
    });
  });

  it('lists a prescription’s medicines and doctor', () => {
    const entry: ContactHistoryEntry = {
      kind: 'prescription',
      id: ID,
      ...day('2026-09-30'),
      patientId: PATIENT,
      seq: 497,
      medicines: ['Sunscreen SPF 50', 'Clonix-B Lotion'],
      doctorName: 'Dr. Drashti Moradiya',
    };
    expect(text(entry)).toBe('Rx #497 · Sunscreen SPF 50, Clonix-B Lotion · Dr. Drashti');
    expect(historyChip(entry, formatWith())).toMatchObject({
      icon: Pill,
      tone: 'sage',
      target: { kind: 'patientFile', patientId: PATIENT, section: 'prescriptions' },
    });
  });

  it('counts a treatment’s session and names its therapist', () => {
    const entry: ContactHistoryEntry = {
      kind: 'treatment',
      id: ID,
      ...at('2026-09-30T09:30:00.000Z'),
      patientId: PATIENT,
      name: 'LHR Full Face',
      session: 1,
      therapistName: 'Kiran Patel',
    };
    expect(text(entry)).toBe('LHR Full Face · session 1 · Kiran P.');
    expect(historyChip(entry, formatWith())).toMatchObject({
      icon: Sparkles,
      tone: 'lav',
      target: { section: 'treatments' },
    });
  });

  it('shows an invoice’s bill and what is due — butter while due, sage when paid', () => {
    const due: ContactHistoryEntry = {
      kind: 'invoice',
      id: ID,
      ...day('2026-09-30'),
      patientId: PATIENT,
      seq: 787,
      type: 'clinic',
      bill: 480_000,
      due: 480_000,
    };
    expect(text(due)).toBe('Clinic invoice #787 · ₹4,800 · ₹4,800 due');
    expect(historyChip(due, formatWith())).toMatchObject({
      icon: Receipt,
      tone: 'butter',
      target: { section: 'invoices' },
    });
    const paid = { ...due, seq: 782, bill: 900_000, due: 0 };
    expect(text(paid)).toBe('Clinic invoice #782 · ₹9,000 · Paid');
    expect(historyChip(paid, formatWith()).tone).toBe('sage');
    expect(text({ ...paid, type: 'consultation', seq: 786, bill: 0 })).toBe(
      'Consultation invoice #786 · ₹0 · Paid',
    );
  });

  it('shows a payment or a refund with its mode and invoice', () => {
    const entry: ContactHistoryEntry = {
      kind: 'payment',
      id: ID,
      ...at('2026-09-30T10:20:00.000Z'),
      patientId: PATIENT,
      refund: false,
      amount: 900_000,
      modes: ['upi'],
      invoiceSeq: 782,
    };
    expect(text(entry)).toBe('Received ₹9,000 · UPI · #782');
    expect(historyChip(entry, formatWith())).toMatchObject({
      icon: Wallet,
      tone: 'mint',
      target: { section: 'payments' },
    });
    expect(text({ ...entry, refund: true, amount: 50_000, invoiceSeq: 760 })).toBe(
      'Refund ₹500 · UPI · #760',
    );
    expect(text({ ...entry, amount: 60_000, modes: ['cash'], invoiceSeq: null })).toBe(
      'Received ₹600 · Cash',
    );
  });

  it('reads a check-in’s feeling, score and what it followed — blush when worse', () => {
    const entry: ContactHistoryEntry = {
      kind: 'checkIn',
      id: ID,
      ...day('2026-09-30'),
      patientId: PATIENT,
      feel: 'same',
      score: 6,
      context: 'Consultation',
    };
    expect(text(entry)).toBe('Check-in · Same · 6/10 · after Consultation');
    expect(historyChip(entry, formatWith())).toMatchObject({
      icon: MessageSquare,
      tone: 'sage',
      target: { section: 'overview' },
    });
    const worse = { ...entry, feel: 'worse', score: null, context: null } as const;
    expect(text(worse)).toBe('Check-in · Worse');
    expect(historyChip(worse, formatWith()).tone).toBe('blush');
  });

  it('rates a review — butter, blush at 3★ or less', () => {
    const entry: ContactHistoryEntry = {
      kind: 'review',
      id: ID,
      ...day('2026-10-02'),
      patientId: PATIENT,
      source: 'google',
      rating: 5,
    };
    expect(text(entry)).toBe('Google review · 5★');
    expect(historyChip(entry, formatWith())).toMatchObject({
      icon: Star,
      tone: 'butter',
      target: { section: 'overview' },
    });
    const low = { ...entry, source: 'internal_form', rating: 3 } as const;
    expect(text(low)).toBe('Feedback form review · 3★');
    expect(historyChip(low, formatWith()).tone).toBe('blush');
    expect(text({ ...entry, source: 'video', rating: null })).toBe('Video review');
  });

  it('closes a task with what closed it — plum, not clickable', () => {
    const entry: ContactHistoryEntry = {
      kind: 'task',
      id: ID,
      ...at('2026-10-03T04:20:00.000Z'),
      title: 'Call Kabir back',
      outcome: 'no_answer',
      result: null,
    };
    expect(text(entry)).toBe('Task · Call Kabir back → No answer');
    expect(historyChip(entry, formatWith())).toMatchObject({
      icon: CheckCircle,
      tone: 'plum',
      target: null,
    });
    // The server's result text wins over the contract outcome's label.
    expect(text({ ...entry, outcome: 'done', result: 'Booked a visit' })).toBe(
      'Task · Call Kabir back → Booked a visit',
    );
  });

  it('masks every ₹ amount behind the patient file’s privacy (H:4848)', () => {
    const invoice: ContactHistoryEntry = {
      kind: 'invoice',
      id: ID,
      ...day('2026-09-30'),
      patientId: PATIENT,
      seq: 787,
      type: 'clinic',
      bill: 480_000,
      due: 480_000,
    };
    expect(text(invoice, true)).toBe('Clinic invoice #787 · ₹ •••• · ₹ •••• due');
    const payment: ContactHistoryEntry = {
      kind: 'payment',
      id: ID,
      ...at('2026-09-30T10:20:00.000Z'),
      patientId: PATIENT,
      refund: false,
      amount: 900_000,
      modes: ['upi'],
      invoiceSeq: 782,
    };
    expect(text(payment, true)).toBe('Received ₹ •••• · UPI · #782');
  });
});

describe('a patient’s history, end to end', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T09:30:00Z'));
    resetAppFixtures();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetAppFixtures();
  });

  it('reads Dharti Galani’s records as the design’s chips, oldest first', async () => {
    const history = await fetchContactHistory({
      kind: 'patient',
      patientId: patientRef('Dharti Galani'),
    });
    expect(history.map((entry) => text(entry))).toEqual([
      'Appointment #2740 · Peel · Completed · Dr. Nisha',
      'Appointment #2790 · Consultation · Completed · Dr. Drashti',
      'LHR Full Face · session 1 · Kiran P.',
      'Rx #497 · Sunscreen SPF 50 · Dr. Drashti',
      'Consultation invoice #786 · ₹0 · Paid',
      'Clinic invoice #787 · ₹4,800 · ₹4,800 due',
      'Check-in · Same · 6/10 · after Consultation',
      'Clinic invoice #782 · ₹9,000 · Paid',
      'Received ₹9,000 · UPI · #782',
      'Check-in · Better · 7/10 · after Day-2 call after LHR',
      'Google review · 5★',
      'Appointment #2859 · Peel · Confirmed · Dr. Nisha',
    ]);
  });
});

describe('the thread as drawn (threadEntries)', () => {
  const LEAD = '00000000-0000-4000-8000-000000000100';
  const TOLD = '00000000-0000-4000-8000-0000000000c1';
  const UNTOLD = '00000000-0000-4000-8000-0000000000c2';

  function line(fields: Partial<LeadMessage> & Pick<LeadMessage, 'id' | 'sentAt'>) {
    const row: LeadMessage = {
      organizationId: '00000000-0000-4000-8000-0000000c1a10',
      createdAt: fields.sentAt,
      updatedAt: fields.sentAt,
      createdById: '00000000-0000-4000-8000-0000000a0001',
      deletedAt: null,
      deleteReason: null,
      deleteNote: null,
      leadId: LEAD,
      channel: 'whatsapp',
      direction: 'received',
      body: 'Hello',
      deliveryStatus: 'delivered',
      isSystem: false,
      authorId: null,
      taskId: null,
      ...fields,
    };
    return row;
  }

  function task(id: string, sentAt: string): ContactHistoryEntry {
    return {
      kind: 'task',
      id,
      ...at(sentAt),
      title: 'Reply to Anaya',
      outcome: 'done',
      result: 'Booked a visit',
    };
  }

  it('merges history and messages oldest first and tells a closed task once', () => {
    const messages = [
      line({
        id: '00000000-0000-4000-8000-0000000000a1',
        sentAt: '2026-10-03T04:00:00.000Z',
      }),
      line({
        id: '00000000-0000-4000-8000-0000000000a2',
        sentAt: '2026-10-03T05:00:00.000Z',
        channel: 'note',
        direction: 'sent',
        isSystem: true,
        body: 'Task closed · Booked a visit',
        taskId: TOLD,
      }),
    ];
    const entries = threadEntries(
      messages,
      [],
      [task(TOLD, '2026-10-03T05:00:00.000Z'), task(UNTOLD, '2026-10-03T04:30:00.000Z')],
      formatWith(),
    );
    expect(entries.map((entry) => [entry.kind, entry.key])).toEqual([
      ['message', '00000000-0000-4000-8000-0000000000a1'],
      ['history', `task:${UNTOLD}`],
      ['system', '00000000-0000-4000-8000-0000000000a2'],
    ]);
  });
});

describe('the divider (threadDivider, H:5785)', () => {
  it('says "no lead" only for a person without one', () => {
    expect(threadDivider(null, true, formatWith())).toBe('Patient · chat only · no lead');
    expect(threadDivider(null, false, formatWith())).toBe(
      'Contact · chat only · no lead',
    );
  });

  it('never denies a lead the host knows of but could not read — it names the way they came (QA-02)', () => {
    expect(threadDivider(null, true, formatWith(), { hasLead: true })).toBe(
      'Lead → appointment → patient',
    );
  });
});
