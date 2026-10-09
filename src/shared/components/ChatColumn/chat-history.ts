import type { TFunction } from 'i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  ChatMessage,
  ChatThread,
  ChatWhen,
  ContactHistoryEntry,
} from '@/shared/api/clinic/messages-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { APPOINTMENT_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { shortPersonName } from '@/shared/components/Cells/PersonAvatar/index.ts';
import type { ClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import type { OutboxMessage } from '@/shared/hooks/useThread/index.ts';
import {
  type AppIcon,
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

import { CHAT_COLUMN_KEYS } from './chat-column.constants.ts';

const keys = CHAT_COLUMN_KEYS;

/** Where a contact-history chip leads (D26 section slugs): the appointment, or a patient-file section. */
export type ChatHistoryTarget =
  | { kind: 'appointment'; appointmentId: string }
  | {
      kind: 'patientFile';
      patientId: string;
      section: 'prescriptions' | 'treatments' | 'invoices' | 'payments' | 'overview';
    };

/** A contact-history line as the thread draws it: an 18px tone circle with its icon, the text and the time. */
export interface HistoryChip {
  key: string;
  text: string;
  icon: AppIcon;
  tone: Tone;
  /** Null for the lines that lead nowhere: reminders and task outcomes. */
  target: ChatHistoryTarget | null;
}

/** How a chat reads dates — the clinic clock (`useClinicClock`). */
export type ChatClock = ClinicClock;

/** What the thread's strings need: the `clinic` translator, money and time. */
export interface ChatFormat {
  /** Translates `clinic` keys in the screen's language. */
  t: TFunction;
  /** Paise as clinic money ("₹4,800"). */
  money: (paise: number) => string;
  clock: ChatClock;
  /** The patient file's privacy: every ₹ amount reads "₹ ••••" (H:4848). */
  maskMoney?: boolean;
}

/**
 * A history chip's or the divider's time by the rooms' one rule
 * (`ClinicClock.moment`; `_patterns.md:193`): "Today 4:00 pm", "Yesterday
 * 9:10 am", "Fri 4:00 pm", "24 Sep 4:00 pm"; ahead "Tomorrow 11:00 am", "9 Oct
 * 4:00 pm" — and the day alone for a record the contract dates without a
 * clock time ("Today", "24 Sep"). A message keeps today's bare time.
 */
export function chatWhenLabel(when: ChatWhen, clock: ChatClock): string {
  return when.kind === 'day' ? clock.day(when.date) : clock.moment(when.at);
}

type Part = string | null | false;

/** The line's parts joined by the design's " · ", each isolated in its own direction. */
function joined(format: ChatFormat, parts: readonly Part[]): string {
  return isolateJoin(parts, format.t(keys.separator));
}

function moneyOf(format: ChatFormat, paise: number): string {
  return format.maskMoney ? format.t(keys.history.masked) : format.money(paise);
}

const nameOf = (name: string | null) => (name ? shortPersonName(name) : null);

type EntryOf<K extends ContactHistoryEntry['kind']> = Extract<
  ContactHistoryEntry,
  { kind: K }
>;

/** Each kind's parts, in the order the design joins them with " · ". */
const HISTORY_PARTS: {
  [K in ContactHistoryEntry['kind']]: (
    entry: EntryOf<K>,
    format: ChatFormat,
  ) => readonly Part[];
} = {
  appointment: (entry, { t }) => [
    t(keys.history.appointment, { seq: entry.seq }),
    entry.service,
    t(CLINIC_KEYS.appointments.statuses[entry.status]),
    nameOf(entry.doctorName),
  ],
  reminder: (entry, { t, clock }) => [
    t(keys.history.reminder),
    entry.service,
    clock.moment(entry.visitAt),
  ],
  prescription: (entry, { t }) => [
    t(keys.history.prescription, { seq: entry.seq }),
    entry.medicines.join(', '),
    nameOf(entry.doctorName),
  ],
  treatment: (entry, { t }) => [
    entry.name,
    t(keys.history.session, { session: entry.session }),
    nameOf(entry.therapistName),
  ],
  invoice: (entry, format) => [
    format.t(keys.history.invoice, {
      type: format.t(CLINIC_KEYS.invoiceTypes[entry.type]),
      seq: entry.seq,
    }),
    moneyOf(format, entry.bill),
    entry.due > 0
      ? format.t(keys.history.due, { amount: moneyOf(format, entry.due) })
      : format.t(keys.history.paid),
  ],
  payment: (entry, format) => [
    format.t(entry.refund ? keys.history.refund : keys.history.received, {
      amount: moneyOf(format, entry.amount),
    }),
    entry.modes.map((mode) => format.t(CLINIC_KEYS.paymentModes[mode])).join(' + '),
    entry.invoiceSeq !== null &&
      format.t(keys.history.invoiceRef, { seq: entry.invoiceSeq }),
  ],
  checkIn: (entry, { t }) => [
    t(keys.history.checkIn),
    t(CLINIC_KEYS.checkInFeels[entry.feel]),
    entry.score !== null && t(keys.history.score, { score: entry.score }),
    entry.context !== null && t(keys.history.after, { context: entry.context }),
  ],
  review: (entry, { t }) => [
    t(keys.history.review, { source: t(CLINIC_KEYS.reviewSources[entry.source]) }),
    entry.rating !== null && t(keys.history.rating, { rating: entry.rating }),
  ],
  task: (entry, { t }) => [
    t(keys.history.task, {
      title: entry.title,
      // The server's result ("Booked a visit"), else the contract outcome's label.
      result: entry.result ?? t(CLINIC_KEYS.taskOutcomes[entry.outcome]),
    }),
  ],
};

/**
 * A contact-history line's text, verbatim from `_patterns.md:184–192`:
 * "Appointment #2740 · Peel · Completed · Dr. Nisha", "Reminder sent ·
 * Treatment · Tomorrow 10:30 am", "Rx #497 · Sunscreen SPF 50 · Dr. Drashti",
 * "LHR Full Face · session 1 · Kiran P.", "Clinic invoice #787 · ₹4,800 ·
 * ₹4,800 due" or "… · Paid", "Received ₹9,000 · UPI · #782" or "Refund …",
 * "Check-in · Same · 6/10 · after Consultation", "Google review · 5★",
 * "Task · Call Kabir back → No answer".
 */
export function historyText(entry: ContactHistoryEntry, format: ChatFormat): string {
  // The map is keyed by kind, so each builder gets its own entry type.
  const parts = HISTORY_PARTS[entry.kind] as (
    line: ContactHistoryEntry,
    lineFormat: ChatFormat,
  ) => readonly Part[];
  return joined(format, parts(entry, format));
}

/**
 * The divider above the first line (`_patterns.md:151`, H:5785): "Lead
 * created · <time> · via <source>", or — for a person without a lead —
 * "Patient · chat only · no lead" / "Contact · chat only · no lead".
 */
export function threadDivider(
  thread: ChatThread | null,
  isPatient: boolean,
  format: ChatFormat,
): string {
  const { t, clock } = format;
  if (thread && thread.kind !== 'contact_thread') {
    return t(keys.created.lead, {
      time: clock.moment(thread.createdAt),
      source: thread.source ? t(CLINIC_KEYS.leads.sources[thread.source]) : '—',
    });
  }
  return t(
    isPatient || thread?.patientId
      ? keys.created.patientThread
      : keys.created.contactThread,
  );
}

/** A line's icon, tone and target (KICKOFF §3.5): the record it came from, by id. */
function chipLook(entry: ContactHistoryEntry): Omit<HistoryChip, 'key' | 'text'> {
  const file = (
    section: Extract<ChatHistoryTarget, { kind: 'patientFile' }>['section'],
  ) =>
    'patientId' in entry
      ? ({ kind: 'patientFile', patientId: entry.patientId, section } as const)
      : null;
  switch (entry.kind) {
    case 'appointment':
      return {
        icon: Calendar,
        tone: APPOINTMENT_STATUS_TONES[entry.status],
        target: { kind: 'appointment', appointmentId: entry.id },
      };
    case 'reminder':
      return { icon: WhatsAppMark, tone: 'sage', target: null };
    case 'prescription':
      return { icon: Pill, tone: 'sage', target: file('prescriptions') };
    case 'treatment':
      return { icon: Sparkles, tone: 'lav', target: file('treatments') };
    case 'invoice':
      return {
        icon: Receipt,
        tone: entry.due > 0 ? 'butter' : 'sage',
        target: file('invoices'),
      };
    case 'payment':
      return { icon: Wallet, tone: 'mint', target: file('payments') };
    case 'checkIn':
      return {
        icon: MessageSquare,
        tone: entry.feel === 'worse' ? 'blush' : 'sage',
        target: file('overview'),
      };
    case 'review':
      return {
        icon: Star,
        tone: entry.rating !== null && entry.rating <= 3 ? 'blush' : 'butter',
        target: file('overview'),
      };
    case 'task':
      return { icon: CheckCircle, tone: 'plum', target: null };
  }
}

/** A contact-history entry as its chip: text, icon, tone and where a click leads. */
export function historyChip(entry: ContactHistoryEntry, format: ChatFormat): HistoryChip {
  return {
    key: `${entry.kind}:${entry.id}`,
    text: historyText(entry, format),
    ...chipLook(entry),
  };
}

/**
 * One line of the thread: a contact-history chip, a system line, a message,
 * or a message still on its way from here.
 */
export type ThreadEntry =
  | { kind: 'history'; key: string; sortAt: string; chip: HistoryChip; when: string }
  | { kind: 'system'; key: string; sortAt: string; text: string; when: string }
  | { kind: 'message'; key: string; sortAt: string; message: ChatMessage }
  | { kind: 'outbox'; key: string; sortAt: string; message: OutboxMessage };

/**
 * The thread as drawn (KICKOFF §3.5): the person's history merged with the
 * conversation oldest → newest — newest at the bottom — and this client's
 * unsent messages last. Ties keep their order: a reply before the status line
 * it caused. A task whose closing line the thread already carries ("Task
 * closed · <result>", `tasks.md:83`) gets no second line from the history.
 */
export function threadEntries(
  messages: readonly ChatMessage[],
  outbox: readonly OutboxMessage[],
  history: readonly ContactHistoryEntry[],
  format: ChatFormat,
): ThreadEntry[] {
  const toldTasks = new Set(
    messages.flatMap((message) =>
      message.isSystem && message.taskId ? [message.taskId] : [],
    ),
  );
  const lines: ThreadEntry[] = [
    ...history
      .filter((entry) => entry.kind !== 'task' || !toldTasks.has(entry.id))
      .map((entry): ThreadEntry => ({
        kind: 'history',
        key: `${entry.kind}:${entry.id}`,
        sortAt: entry.sortAt,
        chip: historyChip(entry, format),
        when: chatWhenLabel(entry.when, format.clock),
      })),
    ...messages.map((message): ThreadEntry =>
      message.isSystem
        ? {
            kind: 'system',
            key: message.id,
            sortAt: message.sentAt,
            text: message.body,
            when: format.clock.moment(message.sentAt, { sameDay: true }),
          }
        : { kind: 'message', key: message.id, sortAt: message.sentAt, message },
    ),
  ];
  const ordered = lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.sortAt.localeCompare(b.line.sortAt) || a.index - b.index)
    .map(({ line }) => line);
  return [
    ...ordered,
    ...outbox.map((message): ThreadEntry => ({
      kind: 'outbox',
      key: message.clientId,
      sortAt: message.at,
      message,
    })),
  ];
}
