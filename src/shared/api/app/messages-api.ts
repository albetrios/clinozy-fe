import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import { compareText, validateAppInput } from './app-fixture-store.ts';
import { invoiceBalance } from './app-money.ts';
import type { Appointment, Branch, LeadMessage, User } from './app-schema.ts';
import { addCivilDays, appClockTime, appInstant, appToday } from './app-time.ts';
import { leadFieldsSchema, type LeadRecord } from './leads-fixture-contracts.ts';
import {
  type ChatAuthor,
  type ChatPerson,
  type ChatSlot,
  type ChatTemplateValues,
  type ChatThread,
  type ChatThreadRead,
  type ChatWhen,
  type ComposerMode,
  type ContactHistoryEntry,
  type MessagingStatus,
  type SendMessageInput,
  sendMessageInputSchema,
} from './messages-contracts.ts';

/*
 * The messaging domain's reads and writes (KICKOFF §3.5 Chat column), on the
 * fixture world until clinozy-be serves them — every call is REPLACE_WITH_API
 * (D6). The contract has `getLead`'s messages and `sendMessage` (`S:1589`,
 * `S:1595`); the rest are Appendix F requests the fixture answers now: a
 * per-person contact-history feed, resend of a failed message, the WhatsApp
 * outage signal and the branch's message links. A person's first message
 * opens their thread through `ensureContactThread` (`contact-threads-api.ts`).
 * The world is imported on demand, so its seed data never lands in a route
 * chunk.
 */

/** TanStack Query keys for the messaging domain, per person (`chatPersonKey`). */
export const messageQueryKeys = {
  all: ['app', 'messages'] as const,
  thread: (personKey: string) => [...messageQueryKeys.all, 'thread', personKey] as const,
  history: (personKey: string) =>
    [...messageQueryKeys.all, 'history', personKey] as const,
  templateValues: (personKey: string) =>
    [...messageQueryKeys.all, 'template-values', personKey] as const,
  status: () => [...messageQueryKeys.all, 'status'] as const,
  /** clinozy-be's messaging status — a contact's chat (`contact-activities-api.ts`). */
  liveStatus: () => [...messageQueryKeys.status(), 'live'] as const,
};

/**
 * The reads a send can change besides the thread, by the `['app', <domain>]`
 * prefix each room keeps its queries under: the lead (status, last touch,
 * involved people, unread — the Leads room and drawer), the rule tasks a reply
 * closes (Tasks, Today) and a patient's new contact thread.
 */
export const MESSAGE_SIDE_EFFECT_KEYS = [
  ['app', 'leads'],
  ['app', 'tasks'],
  ['app', 'contact-threads'],
] as const;

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const messageFixtures = () => import('./fixtures/messages.fixtures.ts');
const threadFixtures = () => import('./fixtures/contact-threads.fixtures.ts');
const staffFixtures = () => import('./fixtures/staff.fixtures.ts');

type World = Awaited<ReturnType<typeof fixtureWorld>>['appFixtures'];

const DAY_MS = 86_400_000;

/** Channels a provider delivers — their messages start `queued` (`S:1595`). */
const DELIVERED: ReadonlySet<ComposerMode> = new Set(['whatsapp', 'instagram']);

// ── Channel status ──

/**
 * Whether WhatsApp is down (Q-L10: the backend signals it; REPLACE_WITH_API —
 * the fixture's switch is `setFixtureWhatsAppOutage`). While it is, WhatsApp
 * replies stay `queued`.
 */
export async function fetchMessagingStatus(): Promise<MessagingStatus> {
  const { fixtureWhatsAppDown } = await messageFixtures();
  return { whatsappDown: fixtureWhatsAppDown() };
}

// ── Threads ──

/**
 * The lead a person's chat lives in (one thread per person, D32): the lead
 * itself; for a patient, the thread `ensureContactThread` binds them to (their
 * most recently active lead, else their contact thread — `findPersonThread`),
 * or `null` until their first message opens one. A 404 for an unknown or
 * deleted record.
 */
async function threadLeadOf(
  world: World,
  person: ChatPerson,
): Promise<LeadRecord | null> {
  // A contact's stream is clinozy-be's (`contact-activities-api.ts`), never the fixture's.
  if (person.kind === 'contact') return null;
  if (person.kind === 'lead') return world.leads.get(person.leadId);
  await world.patients.get(person.patientId);
  const { findPersonThread } = await threadFixtures();
  return findPersonThread(world.leads.snapshot(), {
    leadId: null,
    patientId: person.patientId,
    phone: null,
  });
}

/** The thread a lead record is, as the chat column reads it. */
export function chatThreadOf(lead: LeadRecord): ChatThread {
  return {
    leadId: lead.id,
    kind: lead.kind,
    createdAt: lead.createdAt,
    source: lead.source,
    patientId: lead.patientId,
  };
}

const fullName = (first: string, last: string | null) => `${first} ${last ?? ''}`.trim();

function authorOf(user: User): ChatAuthor {
  return {
    id: user.id,
    name: fullName(user.firstName, user.lastName),
    initials: user.initials,
    tone: user.tone,
    roles: user.roles,
    phone: user.phone,
    email: user.email,
    online: user.presence === 'online',
  };
}

function authorsOf(
  world: World,
  messages: readonly LeadMessage[],
): Record<string, ChatAuthor> {
  const ids = new Set(messages.flatMap((message) => message.authorId ?? []));
  return Object.fromEntries(
    world.staff
      .snapshot((user) => ids.has(user.id))
      .map((user) => [user.id, authorOf(user)]),
  );
}

/**
 * A person's thread with every message oldest first (`getLead`, `S:1589`:
 * cursor pages of 50, `sentAt` ascending; REPLACE_WITH_API) and the team
 * members those messages name. A patient without a thread reads as none.
 */
export async function fetchThread(person: ChatPerson): Promise<ChatThreadRead> {
  const { appFixtures: world } = await fixtureWorld();
  const lead = await threadLeadOf(world, person);
  if (!lead) return { thread: null, messages: [], authors: {} };
  const messages = await collectAllPages(async (cursor) => {
    const page = await world.leadMessages.list({
      where: (message) => message.leadId === lead.id,
      sort: (a, b) => compareText(a.sentAt, b.sentAt),
      cursor,
    });
    return { rows: page.items, next: page.nextCursor };
  }, 'messages');
  return { thread: chatThreadOf(lead), messages, authors: authorsOf(world, messages) };
}

// ── Contact history ──

const instant = (at: string): { when: ChatWhen; sortAt: string } => ({
  when: { kind: 'instant', at },
  sortAt: at,
});

/**
 * A record the contract dates without a clock time: shown as its day, sorted
 * by when it was entered on that day (else the morning of it).
 */
function day(date: string, createdAt: string): { when: ChatWhen; sortAt: string } {
  const enteredThatDay = appToday(new Date(createdAt)) === date;
  return {
    when: { kind: 'day', date },
    sortAt: enteredThatDay ? createdAt : appInstant(date, '09:00'),
  };
}

function staffNames(world: World): (id: string | null) => string | null {
  const names = new Map(
    world.staff
      .snapshot()
      .map((user) => [user.id, fullName(user.firstName, user.lastName)]),
  );
  return (id) => (id === null ? null : (names.get(id) ?? null));
}

function appointmentLines(
  appointments: readonly Appointment[],
  nameOf: (id: string | null) => string | null,
  now: Date,
): ContactHistoryEntry[] {
  return appointments.flatMap((appointment): ContactHistoryEntry[] => {
    const at = appInstant(appointment.date, appointment.startTime);
    const visit: ContactHistoryEntry = {
      kind: 'appointment',
      id: appointment.id,
      ...instant(at),
      seq: appointment.seq,
      service: appointment.serviceLabel,
      status: appointment.status,
      doctorName: nameOf(appointment.doctorId),
    };
    // The prototype's reminder goes out a day before a visit that has one
    // (`fu`, H:3985); a reminder not sent yet is not history.
    const sentAt = new Date(Date.parse(at) - DAY_MS).toISOString();
    const reminded =
      appointment.followUpAt !== null &&
      appointment.status !== 'cancelled' &&
      Date.parse(sentAt) <= now.getTime();
    if (!reminded) return [visit];
    return [
      visit,
      {
        kind: 'reminder',
        id: appointment.id,
        ...instant(sentAt),
        service: appointment.serviceLabel,
        visitAt: at,
      },
    ];
  });
}

function patientLines(
  world: World,
  patientId: string,
  nameOf: (id: string | null) => string | null,
): ContactHistoryEntry[] {
  const mine = <T extends { patientId: string | null }>(row: T) =>
    row.patientId === patientId;
  const payments = world.payments.snapshot();
  const invoices = world.invoices.snapshot();
  const invoiceSeq = new Map(invoices.map((invoice) => [invoice.id, invoice.seq]));
  return [
    ...world.prescriptions.snapshot(mine).map((rx): ContactHistoryEntry => ({
      kind: 'prescription',
      id: rx.id,
      ...day(rx.date, rx.createdAt),
      patientId,
      seq: rx.seq,
      medicines: rx.items.map((item) => item.medicineName).filter(Boolean),
      doctorName: nameOf(rx.doctorId),
    })),
    ...world.treatments.snapshot(mine).map((treatment): ContactHistoryEntry => ({
      kind: 'treatment',
      id: treatment.id,
      ...instant(treatment.performedAt),
      patientId,
      name: treatment.name,
      session: treatment.sessionNo,
      therapistName: nameOf(treatment.therapistId),
    })),
    ...invoices.filter(mine).map((invoice): ContactHistoryEntry => {
      const { bill, due } = invoiceBalance(invoice, payments);
      return {
        kind: 'invoice',
        id: invoice.id,
        ...day(invoice.date, invoice.createdAt),
        patientId,
        seq: invoice.seq,
        type: invoice.type,
        bill,
        due,
      };
    }),
    ...payments
      .filter((payment) => mine(payment) && ['receipt', 'refund'].includes(payment.kind))
      .map((payment): ContactHistoryEntry => ({
        kind: 'payment',
        id: payment.id,
        ...instant(payment.paidAt),
        patientId,
        refund: payment.kind === 'refund',
        amount: payment.amount,
        modes: [...new Set(payment.splits.map((split) => split.mode))],
        invoiceSeq: payment.invoiceId
          ? (invoiceSeq.get(payment.invoiceId) ?? null)
          : null,
      })),
    ...world.checkIns.snapshot(mine).map((checkIn): ContactHistoryEntry => ({
      kind: 'checkIn',
      id: checkIn.id,
      ...day(checkIn.date, checkIn.createdAt),
      patientId,
      feel: checkIn.feel,
      // The contract's score has no "none" yet (Appendix F): 0 reads as unscored.
      score: checkIn.score > 0 ? checkIn.score : null,
      context: checkIn.context || null,
    })),
    ...world.reviews.snapshot(mine).map((review): ContactHistoryEntry => ({
      kind: 'review',
      id: review.id,
      ...day(review.date, review.createdAt),
      patientId,
      source: review.source,
      rating: review.rating,
    })),
  ];
}

/**
 * A person's contact history, oldest first (KICKOFF §3.5; Appendix F's merged
 * feed — REPLACE_WITH_API): their appointments and the reminders sent for
 * them, prescriptions, treatments, invoices with what is still due, payments
 * and refunds, check-ins, reviews and resolved tasks with what closed them —
 * joined by id: the patient's records, and the bookings and tasks of their
 * thread.
 */
export async function fetchContactHistory(
  person: ChatPerson,
  now: Date = new Date(),
): Promise<ContactHistoryEntry[]> {
  const { appFixtures: world } = await fixtureWorld();
  const lead = await threadLeadOf(world, person);
  const patientId =
    person.kind === 'patient' ? person.patientId : (lead?.patientId ?? null);
  const leadId = lead?.id ?? null;
  const isTheirs = (row: { patientId: string | null; leadId: string | null }) =>
    (patientId !== null && row.patientId === patientId) ||
    (leadId !== null && row.leadId === leadId);
  const nameOf = staffNames(world);
  const entries: ContactHistoryEntry[] = [
    ...appointmentLines(world.appointments.snapshot(isTheirs), nameOf, now),
    ...(patientId === null ? [] : patientLines(world, patientId, nameOf)),
    ...world.tasks
      .snapshot(
        (task) =>
          task.status === 'done' &&
          (task.outcome !== null || task.result !== null) &&
          isTheirs(task),
      )
      .map((task): ContactHistoryEntry => ({
        kind: 'task',
        id: task.id,
        ...instant(task.resolvedAt ?? task.updatedAt),
        title: task.title,
        // A rule outcome the contract has no value for closes the task as done.
        outcome: task.outcome ?? 'done',
        result: task.result,
      })),
  ];
  return entries.sort((a, b) => compareText(a.sortAt, b.sortAt));
}

// ── Template values ──

function addressOf(branch: Branch): string {
  return [branch.addressLine1, branch.addressLine2, branch.area, branch.city]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

const hourOf = (clock: string) => Number(clock.slice(0, 2));

/**
 * The next two free slots: over the next `days` days, the
 * first candidate time no booking starts at — later today only after this
 * hour (H:5741).
 */
function freeSlotsFrom(
  bookings: readonly Appointment[],
  now: Date,
  times: readonly string[],
  days: number,
): ChatSlot[] {
  const today = appToday(now);
  const hourNow = hourOf(appClockTime(now));
  const taken = new Set(
    bookings.map((booking) => `${booking.date} ${booking.startTime}`),
  );
  const slots: ChatSlot[] = [];
  for (let offset = 0; offset < days && slots.length < 2; offset += 1) {
    const date = addCivilDays(today, offset);
    const open = (candidate: string): boolean => {
      // Today's hours already gone are never offered.
      if (offset === 0 && hourOf(candidate) <= hourNow) return false;
      return !taken.has(`${date} ${candidate}`);
    };
    const time = times.find(open);
    if (time) slots.push({ date, time });
  }
  return slots;
}

/**
 * What starters, templates and "Fill in" put in a message (REPLACE_WITH_API:
 * the organisation, the thread's branch with its maps and review links —
 * Appendix F "Branches" — and the free-slot read): the person's branch, else
 * the main one.
 */
export async function fetchTemplateValues(
  person: ChatPerson,
  now: Date = new Date(),
): Promise<ChatTemplateValues> {
  const [{ appFixtures: world, clinicOrganization }, links] = await Promise.all([
    fixtureWorld(),
    messageFixtures(),
  ]);
  const lead = await threadLeadOf(world, person);
  const homeBranch =
    person.kind === 'patient'
      ? (await world.patients.get(person.patientId)).homeBranchId
      : null;
  const branches = world.branches.snapshot();
  const branch =
    branches.find((candidate) => candidate.id === (lead?.branchId ?? homeBranch)) ??
    branches.find((candidate) => candidate.isMain) ??
    branches[0];
  const branchLinks = branch ? links.branchMessageLinksSeed()[branch.id] : undefined;
  return {
    clinicName: clinicOrganization().name,
    address: branch ? addressOf(branch) : '',
    mapsLink: branchLinks?.mapsLink ?? '',
    reviewLink: branchLinks?.reviewLink ?? '',
    freeSlots: freeSlotsFrom(
      world.appointments.snapshot((booking) => booking.status !== 'cancelled'),
      now,
      links.FREE_SLOT_TIMES,
      links.FREE_SLOT_DAYS,
    ),
  };
}

// ── Writes ──

/**
 * Hand a queued message to its provider: the fixture's providers accept at
 * once (`sent`), except WhatsApp during an outage, which stays `queued`.
 * Later receipts (delivered, read) are the provider's — none on fixtures.
 */
async function acceptForDelivery(world: World, message: LeadMessage): Promise<void> {
  const { fixtureWhatsAppDown } = await messageFixtures();
  if (message.channel === 'whatsapp' && fixtureWhatsAppDown()) return;
  await world.leadMessages.update(message.id, { deliveryStatus: 'sent' });
}

/** The system line each sending channel writes when it moves a New lead to Contacted (`_patterns.md:158`). */
const CONTACTED_LINES: Readonly<Partial<Record<ComposerMode, string>>> = {
  whatsapp: 'Status → Contacted (first reply)',
  instagram: 'Status → Contacted (first reply)',
  call: 'Status → Contacted (call logged)',
};

/** One send, as the rules read it. */
interface Send {
  channel: ComposerMode;
  /** The member who sent it — the session's staff profile on the server. */
  senderId: string;
  at: string;
}

/**
 * What a send does to its pipeline lead's team (Q-L9, H:1791): the owner's
 * message is their activity — the hold starts again; anyone else's adds them
 * to the involved people ("Added automatically when they reply, call, note or
 * book"), within the lead's limit.
 */
function teamAfterSend(
  lead: LeadRecord,
  send: Send,
): Partial<Pick<LeadRecord, 'touchedAt' | 'releasedAt' | 'involvedIds'>> {
  if (lead.isContactThread) return {};
  if (lead.ownerId === send.senderId) return { touchedAt: send.at, releasedAt: null };
  if (lead.involvedIds.includes(send.senderId)) return {};
  const involvedIds = [...lead.involvedIds, send.senderId];
  return leadFieldsSchema.shape.involvedIds.safeParse(involvedIds).success
    ? { involvedIds }
    : {};
}

/**
 * The server's rules for a send (KICKOFF §6.3 status side effects, Q-L9): the
 * first WhatsApp or Instagram reply to a New lead — a re-targeted lead starts
 * New — or a call logged on one moves it to Contacted with a system line; the
 * sender's team rule ({@link teamAfterSend}); and a reply reads the thread
 * (its unread count clears). A contact thread has no status or team to move.
 */
async function applySendRules(world: World, lead: LeadRecord, send: Send): Promise<void> {
  const line = lead.status === 'new' ? CONTACTED_LINES[send.channel] : undefined;
  await world.leads.update(lead.id, {
    ...teamAfterSend(lead, send),
    unreadCount: 0,
    ...(line ? { status: 'contacted' as const } : {}),
  });
  if (!line) return;
  const { systemLine } = await messageFixtures();
  await world.leadMessages.create(systemLine(lead.id, line, null, new Date(send.at)));
}

/**
 * Send on a thread (`sendMessage`, `S:1595`; REPLACE_WITH_API): validated like
 * clinozy-be (a 422 for an empty or over-long body, a 404 for a gone thread);
 * WhatsApp and Instagram messages come back `queued`, a call log or note
 * `sent`. The author is the signed-in member (the fixture's viewer). Applies
 * the send rules, then returns the message as written.
 */
export async function sendMessage(input: SendMessageInput): Promise<LeadMessage> {
  const [{ appFixtures: world }, { FIXTURE_VIEWER_ID }] = await Promise.all([
    fixtureWorld(),
    staffFixtures(),
  ]);
  const fields = validateAppInput(sendMessageInputSchema, input);
  const lead = await world.leads.get(fields.leadId);
  const sentAt = new Date().toISOString();
  const delivered = DELIVERED.has(fields.channel);
  const message = await world.leadMessages.create({
    leadId: lead.id,
    channel: fields.channel,
    direction: 'sent',
    body: fields.body,
    deliveryStatus: delivered ? 'queued' : 'sent',
    isSystem: false,
    authorId: FIXTURE_VIEWER_ID,
    taskId: null,
    sentAt,
  });
  if (delivered) await acceptForDelivery(world, message);
  await applySendRules(world, lead, {
    channel: fields.channel,
    senderId: FIXTURE_VIEWER_ID,
    at: sentAt,
  });
  return message;
}

/**
 * Resend a message its provider could not deliver (Appendix F "resend for
 * failed messages"; REPLACE_WITH_API): it queues again. Anything not failed is
 * returned as it is.
 */
export async function resendMessage(messageId: string): Promise<LeadMessage> {
  const { appFixtures: world } = await fixtureWorld();
  const message = await world.leadMessages.get(messageId);
  if (message.deliveryStatus !== 'failed') return message;
  const queued = await world.leadMessages.update(messageId, { deliveryStatus: 'queued' });
  await acceptForDelivery(world, queued);
  return queued;
}
