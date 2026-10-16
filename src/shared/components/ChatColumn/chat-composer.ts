import type { TFunction } from 'i18next';

import { isolateText, isolateValues } from '@/lib/bidi-isolate.ts';
import type { Channel, LeadInterest, Tone } from '@/shared/api/app/app-schema.ts';
import { addCivilDays, appInstant, civilDayOffset } from '@/shared/api/app/app-time.ts';
import type {
  Contact,
  ContactPreferenceTag,
} from '@/shared/api/app/contacts-contracts.ts';
import type { LeadRecord } from '@/shared/api/app/leads-fixture-contracts.ts';
import type {
  ChatMessage,
  ChatSlot,
  ComposerMode,
  ContactHistoryEntry,
} from '@/shared/api/app/messages-contracts.ts';
import {
  type AppIcon,
  Bell,
  Calendar,
  MapPin,
  Phone,
  Sparkles,
  Wallet,
  WhatsAppMark,
} from '@/shared/icons/index.ts';

import { CHAT_COLUMN_KEYS } from './chat-column.constants.ts';
import type { ChatClock } from './chat-history.ts';

const keys = CHAT_COLUMN_KEYS;
const content = keys.content;

// ── The person ──

/**
 * The person a chat column writes to, as its host knows them — the lead or
 * patient record (D32: there is no Contact entity). The reach fields are the
 * plan's contact fields (Appendix F), passed through when the host has them.
 */
export interface ChatContact {
  name: string;
  /** E.164. */
  phone: string | null;
  /** Sage avatar with the "P" badge; else lav. */
  isPatient: boolean;
  /** The WhatsApp mode is offered only when the contact is on WhatsApp (default true). */
  onWhatsApp?: boolean;
  /** Their Instagram handle; without one the Instagram mode is disabled. */
  instagram?: string | null;
  /** The channel the composer opens on when there is no message yet. */
  defaultChannel?: Channel | null;
  /** Their contact preferences, as stored (`PREFS`, H:3368). */
  preferences?: readonly string[];
  /** What they are interested in (a lead's `interests`) — names the treatment in messages. */
  interests?: readonly LeadInterest[];
}

/** The preference tags the composer warns about (`PREFS`, H:3368; `preference_tags`, CT14). */
export const CONTACT_PREFERENCES = {
  noCalls: 'no_calls',
  afterSix: 'after_six_pm',
} satisfies Record<string, ContactPreferenceTag>;

/** A person's first name, as messages and hints address them. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/**
 * The person a lead thread writes to, from the lead's contact fields (D32): its
 * mobiles' WhatsApp marks, its Instagram, default channel, preferences and
 * interests — the lead drawer's and the task drawer's chat columns read it.
 */
export function chatContactOfLead(
  lead: Pick<LeadRecord, 'name' | 'phone' | 'patientId' | 'contact' | 'interests'>,
): ChatContact {
  const phones = lead.contact?.phones ?? [{ phone: lead.phone, whatsapp: true }];
  return {
    name: lead.name,
    phone: lead.phone,
    isPatient: lead.patientId !== null,
    onWhatsApp: phones.some((entry) => entry.whatsapp),
    instagram: lead.contact?.instagram[0] ?? null,
    defaultChannel: lead.contact?.defaultChannel ?? null,
    preferences: lead.contact?.preferences ?? [],
    interests: lead.interests,
  };
}

/** Each default channel of a contact as the composer's channel. */
const COMPOSER_CHANNEL_OF: Readonly<Record<Contact['defaultChannel'], Channel>> = {
  whatsapp: 'whatsapp',
  call: 'call',
  instagram: 'instagram',
};

/**
 * The person a contact's chat writes to (`GET /app/contacts/:contact_id`): whether any number is
 * on WhatsApp, their first Instagram handle, their default channel and preference tags — the
 * name, number, patient badge and interests from the host's record. Until the contact is read,
 * the host's alone.
 */
export function chatContactOfContact(
  person: Pick<ChatContact, 'name' | 'phone' | 'isPatient' | 'interests'>,
  contact:
    | Pick<Contact, 'phones' | 'instagramHandles' | 'defaultChannel' | 'preferenceTags'>
    | undefined,
): ChatContact {
  if (!contact) return person;
  return {
    ...person,
    onWhatsApp: contact.phones.some((entry) => entry.isOnWhatsapp),
    instagram: contact.instagramHandles[0] ?? null,
    defaultChannel: COMPOSER_CHANNEL_OF[contact.defaultChannel],
    preferences: contact.preferenceTags,
  };
}

// ── "Send via" ──

/** One "Send via" tab: its mode and whether it can be picked. */
export interface ComposerModeOption {
  mode: ComposerMode;
  disabled: boolean;
}

/**
 * The "Send via" tabs (KICKOFF §3.5): WhatsApp only when the contact is on
 * WhatsApp, Instagram disabled without a handle, then Call log and Note.
 */
export function composerModes(contact: ChatContact): ComposerModeOption[] {
  return [
    ...(contact.onWhatsApp === false
      ? []
      : [{ mode: 'whatsapp' as const, disabled: false }]),
    { mode: 'instagram', disabled: !contact.instagram },
    { mode: 'call', disabled: false },
    { mode: 'note', disabled: false },
  ];
}

const MESSAGE_MODES: ReadonlySet<Channel> = new Set(['whatsapp', 'instagram']);
const isMessageChannel = (channel: Channel) => MESSAGE_MODES.has(channel);

/** A channel as a composer mode, when the composer can send on it. */
function modeOf(channel: Channel | null | undefined): ComposerMode | null {
  return channel === 'whatsapp' ||
    channel === 'instagram' ||
    channel === 'call' ||
    channel === 'note'
    ? channel
    : null;
}

/** The last item that passes the test (the lib targets ES2022 — no `findLast`). */
function lastWhere<T>(items: readonly T[], test: (item: T) => boolean): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && test(item)) return item;
  }
  return undefined;
}

/** The newest message they sent us, if any. */
export function lastInbound(messages: readonly ChatMessage[]): ChatMessage | null {
  return (
    lastWhere(
      messages,
      (message) => !message.isSystem && message.direction === 'received',
    ) ?? null
  );
}

/**
 * The mode a thread opens on (`leads.md:36`, H:5641): the channel of their
 * last message, else of our last message, else the default channel — and,
 * when that tab can't be picked, WhatsApp or else the call log.
 */
export function initialComposerMode(
  messages: readonly ChatMessage[],
  contact: ChatContact,
): ComposerMode {
  const words = messages.filter(
    (message) => !message.isSystem && isMessageChannel(message.channel),
  );
  const last =
    lastWhere(words, (message) => message.direction === 'received') ??
    lastWhere(words, (message) => message.direction === 'sent');
  const wanted = modeOf(last?.channel) ?? modeOf(contact.defaultChannel) ?? 'whatsapp';
  const options = composerModes(contact);
  const usable = (mode: ComposerMode) =>
    options.some((option) => option.mode === mode && !option.disabled);
  if (usable(wanted)) return wanted;
  return usable('whatsapp') ? 'whatsapp' : 'call';
}

/**
 * Whether the "Send via" tabs show their labels (H:5770): only when the
 * dragged chat width (420 by default), capped by a third of the window, is at
 * least 460px — so never at the default width, never on a phone.
 */
export function composerShowsLabels(
  viewportWidth: number,
  preferredWidth = 420,
): boolean {
  return Math.min(preferredWidth, Math.max(300, Math.round(0.34 * viewportWidth))) >= 460;
}

/** The line beside the tabs about where they last wrote (`leads.md:428`). */
export type ReplyHint =
  { kind: 'here' } | { kind: 'mismatch'; channel: 'whatsapp' | 'instagram' } | null;

/**
 * "<First> last wrote here" in the channel of their last message; on the
 * other messaging channel the "<First> wrote on <Channel> · Switch" chip; on a
 * call log or note, nothing.
 */
export function replyHint(lastFrom: ChatMessage | null, mode: ComposerMode): ReplyHint {
  const channel = lastFrom?.channel;
  if (channel !== 'whatsapp' && channel !== 'instagram') return null;
  if (mode === channel) return { kind: 'here' };
  if (mode === 'call' || mode === 'note') return null;
  return { kind: 'mismatch', channel };
}

/**
 * The preference warning on the tabs' row (`_patterns.md:166`): "Prefers no
 * calls · message instead" on the call log for a no-calls contact, else
 * "Prefers contact after 6 pm".
 */
export function preferenceWarning(
  mode: ComposerMode,
  preferences: readonly string[] = [],
): 'noCalls' | 'afterSix' | null {
  if (mode === 'call' && preferences.includes(CONTACT_PREFERENCES.noCalls))
    return 'noCalls';
  if (preferences.includes(CONTACT_PREFERENCES.afterSix)) return 'afterSix';
  return null;
}

// ── Messages in the thread ──

/** How a message is drawn: ours or theirs on a channel, a logged call, a team note. */
export type BubbleKind = 'out' | 'in' | 'call' | 'note';

/** A message's bubble kind (KICKOFF §3.5 Messages). */
export function bubbleKind(
  message: Pick<ChatMessage, 'channel' | 'direction'>,
): BubbleKind {
  if (message.channel === 'note') return 'note';
  if (message.channel === 'call') return 'call';
  return message.direction === 'sent' ? 'out' : 'in';
}

/** What the meta line says about delivery (D22). */
export type DeliveryView =
  | { kind: 'none' }
  | { kind: 'sending' }
  | { kind: 'failed' }
  | { kind: 'status'; status: 'sent' | 'delivered' | 'read' | 'queued' };

/**
 * A sent message's delivery as the design labels it (D22): `queued` reads
 * "Sending…" — or "Queued" for WhatsApp while WhatsApp is down, and for every
 * channel while no messaging service is connected — `failed` reads "Not sent"
 * with a Retry; theirs, notes and call logs say nothing.
 */
export function deliveryView(
  message: Pick<ChatMessage, 'channel' | 'direction' | 'deliveryStatus' | 'isSystem'>,
  whatsappDown: boolean,
  isConnected = true,
): DeliveryView {
  if (message.isSystem || bubbleKind(message) !== 'out') return { kind: 'none' };
  switch (message.deliveryStatus) {
    case 'failed':
      return { kind: 'failed' };
    case 'queued':
      return !isConnected || (whatsappDown && message.channel === 'whatsapp')
        ? { kind: 'status', status: 'queued' }
        : { kind: 'sending' };
    default:
      return { kind: 'status', status: message.deliveryStatus };
  }
}

/** "Book an appointment"'s reason: the first 80 characters of their last message (H:5751). */
export function bookingReason(lastFrom: ChatMessage | null): string | null {
  return lastFrom ? lastFrom.body.slice(0, 80) : null;
}

// ── Visits: the empty card and the starters ──

type AppointmentLine = Extract<ContactHistoryEntry, { kind: 'appointment' }>;

/** Their next visit and whether they have been before (H:5797). */
export interface VisitSummary {
  /** The soonest visit from today that is still on (not cancelled, completed or a no-show). */
  upcoming: AppointmentLine | null;
  hasPastVisits: boolean;
}

const DONE: ReadonlySet<AppointmentLine['status']> = new Set([
  'cancelled',
  'completed',
  'no_show',
]);

/** Their visits, from the contact history, on the clinic clock. */
export function visitSummary(
  history: readonly ContactHistoryEntry[],
  clock: Pick<ChatClock, 'today' | 'dayOf'>,
): VisitSummary {
  const visits = history.filter(
    (entry): entry is AppointmentLine => entry.kind === 'appointment',
  );
  const dayOf = (visit: AppointmentLine) =>
    visit.when.kind === 'instant' ? clock.dayOf(visit.when.at) : visit.when.date;
  const upcoming =
    visits
      .filter((visit) => dayOf(visit) >= clock.today && !DONE.has(visit.status))
      .sort((a, b) => a.sortAt.localeCompare(b.sortAt))[0] ?? null;
  return {
    upcoming,
    hasPastVisits: visits.some((visit) => dayOf(visit) < clock.today),
  };
}

/** The empty card's starter set (`_patterns.md:174–177`). */
export type StarterSet = 'visitToday' | 'visitLater' | 'pastVisits' | 'noVisits';

/** Which starters fit: a visit today they haven't checked in for, a later visit, past visits only, none. */
export function starterSet(
  visits: VisitSummary,
  clock: Pick<ChatClock, 'today' | 'dayOf'>,
): StarterSet {
  const { upcoming } = visits;
  if (upcoming?.when.kind === 'instant') {
    const today =
      clock.dayOf(upcoming.when.at) === clock.today && upcoming.status !== 'checked_in';
    return today ? 'visitToday' : 'visitLater';
  }
  return visits.hasPastVisits ? 'pastVisits' : 'noVisits';
}

/** The starter chips per set, in order: the chip's label key and its message. */
const STARTERS: Readonly<
  Record<
    StarterSet,
    readonly { label: keyof typeof keys.starters; text: keyof typeof content.starters }[]
  >
> = {
  visitToday: [
    { label: 'onTheWay', text: 'onTheWay' },
    { label: 'directions', text: 'directionsToday' },
    { label: 'newTime', text: 'newTime' },
  ],
  visitLater: [
    { label: 'confirm', text: 'confirm' },
    { label: 'prep', text: 'prep' },
    { label: 'directions', text: 'directionsLater' },
  ],
  pastVisits: [
    { label: 'howItWent', text: 'howItWent' },
    { label: 'nextSession', text: 'nextSession' },
    { label: 'offer', text: 'offer' },
  ],
  noVisits: [
    { label: 'hello', text: 'hello' },
    { label: 'consultation', text: 'consultation' },
    { label: 'directions', text: 'directions' },
  ],
};

// ── Message content ──

/** Who is writing: the signed-in member's first and short names ("Riya", "Riya S."). */
export interface ChatSender {
  first: string;
  short: string;
}

/**
 * Everything a starter, chip or template puts in a message — in the message
 * language ({@link MessageContext.tm}), from the clinic's settings, never
 * literals (§7.3).
 */
export interface MessageContext {
  /** Translates `app` keys in the patient-message language (Q-X2). */
  tm: TFunction;
  clock: ChatClock;
  /** Their first name ("there" with none). */
  first: string;
  me: ChatSender;
  clinic: string;
  mapsLink: string;
  /** The offering their interest names (else the catalogue's first): name, price text, sessions. */
  offering: { name: string; price: string; sessions: number } | null;
  /** Their interest in the message language ("your treatment" with none). */
  interest: string;
  freeSlots: readonly ChatSlot[];
  /** Their next visit, for the starters and "day time". */
  upcoming: AppointmentLine | null;
}

/** The words a day takes inside a sentence: "today", "tomorrow", "on 9 Oct". */
interface DayWords {
  today: string;
  tomorrow: string;
  onDate: string;
}

/** The empty card's day words (screen language). */
const SCREEN_DAYS: DayWords = keys.empty;
/** A message's day words (patient-message language). */
const MESSAGE_DAYS: DayWords = content;

/** "today" / "tomorrow" / "on 9 Oct" — a visit's day inside a sentence. */
function dayPhrase(
  date: string,
  clock: ChatClock,
  translate: TFunction,
  words: DayWords,
): string {
  const offset = civilDayOffset(clock.today, date);
  if (offset === 0) return translate(words.today);
  if (offset === 1) return translate(words.tomorrow);
  return translate(words.onDate, { date: clock.date(date) });
}

/** One starter chip: its label (screen language) and the message it fills in. */
export interface Starter {
  key: string;
  label: string;
  text: string;
}

/**
 * The empty card's three starters, verbatim (`_patterns.md:174–178`): the
 * labels in the screen's language, the messages in the patient's.
 */
export function starters(set: StarterSet, t: TFunction, ctx: MessageContext): Starter[] {
  const visit = ctx.upcoming;
  const at = visit?.when.kind === 'instant' ? visit.when.at : null;
  const values = {
    first: ctx.first,
    service: visit?.service ?? '',
    time: at ? ctx.clock.time(at) : '',
    when: at ? dayPhrase(ctx.clock.dayOf(at), ctx.clock, ctx.tm, MESSAGE_DAYS) : '',
    maps: ctx.mapsLink,
    me: ctx.me.short,
    clinic: ctx.clinic,
  };
  return STARTERS[set].map(({ label, text }) => ({
    key: label,
    label: t(keys.starters[label]),
    text: ctx.tm(content.starters[text], values),
  }));
}

/**
 * The empty card's line for the set (`_patterns.md:171–173`), in the screen's
 * language — its name, service, day and time isolated (the date inside "on 9
 * Oct" too), so each stays whole on a right-to-left page.
 */
export function emptyLine(
  set: StarterSet,
  t: TFunction,
  first: string,
  upcoming: AppointmentLine | null,
  clock: ChatClock,
): string {
  if (
    (set === 'visitToday' || set === 'visitLater') &&
    upcoming?.when.kind === 'instant'
  ) {
    const { at } = upcoming.when;
    const screenClock = {
      ...clock,
      date: (date: string) => isolateText(clock.date(date)),
    };
    return t(
      keys.empty.visit,
      isolateValues({
        first,
        service: upcoming.service,
        when: dayPhrase(clock.dayOf(at), screenClock, t, SCREEN_DAYS),
        time: clock.time(at),
      }),
    );
  }
  return set === 'pastVisits'
    ? t(keys.empty.pastVisits, { first: isolateText(first) })
    : t(keys.empty.noVisits);
}

/** The eight templates (`_patterns.md:181`) with their tile tone and icon. */
const TEMPLATES = [
  { kind: 'greeting', tone: 'sage', icon: WhatsAppMark },
  { kind: 'price', tone: 'butter', icon: Wallet },
  { kind: 'slots', tone: 'sky', icon: Calendar },
  { kind: 'location', tone: 'lav', icon: MapPin },
  { kind: 'reminder', tone: 'sky', icon: Bell },
  { kind: 'aftercare', tone: 'mint', icon: Sparkles },
  { kind: 'followUp', tone: 'butter', icon: Phone },
  { kind: 'review', tone: 'sage', icon: Sparkles },
] as const satisfies readonly { kind: string; tone: Tone; icon: AppIcon }[];

/** A template's kind. */
export type TemplateKind = (typeof TEMPLATES)[number]['kind'];

/** A fill-in placeholder as the message carries it: "{{address}}", in the message language. */
function fillToken(tm: TFunction, name: keyof typeof content.fill): string {
  return `{{${tm(content.fill[name])}}}`;
}

/** "today 4 pm" / "tomorrow 12:30 pm" / "5 Oct 11 am" — a free slot as a message offers it. */
function slotPhrase(slot: ChatSlot, ctx: MessageContext): string {
  const offset = civilDayOffset(ctx.clock.today, slot.date);
  let day: string;
  if (offset === 0) day = ctx.tm(content.today);
  else if (offset === 1) day = ctx.tm(content.tomorrow);
  else day = ctx.clock.date(slot.date);
  return ctx.tm(content.slot, {
    day,
    time: ctx.clock.shortTime(appInstant(slot.date, slot.time)),
  });
}

/** The two slots a message offers — tomorrow 11 am and 4 pm when none are free (H:5741). */
function slotsPhrase(ctx: MessageContext): string {
  const tomorrow = addCivilDays(ctx.clock.today, 1);
  const slots = ctx.freeSlots.length
    ? ctx.freeSlots
    : [
        { date: tomorrow, time: '11:00' },
        { date: tomorrow, time: '16:00' },
      ];
  const [first, second] = slots.map((slot) => slotPhrase(slot, ctx));
  return second ? ctx.tm(content.slotPair, { first, second }) : (first ?? '');
}

/** A template's message, verbatim (`_patterns.md:181`); placeholders stay "{{…}}" for "Fill in". */
export function templateText(kind: TemplateKind, ctx: MessageContext): string {
  const { tm } = ctx;
  const offering = ctx.offering ?? { name: ctx.interest, price: '', sessions: 1 };
  switch (kind) {
    case 'greeting':
      return tm(content.templates.greeting, {
        first: ctx.first,
        me: ctx.me.first,
        clinic: ctx.clinic,
      });
    case 'price':
      return tm(
        offering.sessions > 1 ? content.templates.priceSessions : content.templates.price,
        { offering: offering.name, price: offering.price, sessions: offering.sessions },
      );
    case 'slots':
      return tm(content.templates.slots, {
        slots: slotsPhrase(ctx),
        interest: ctx.interest,
      });
    case 'location':
      return tm(content.templates.location, {
        address: fillToken(tm, 'address'),
        maps: fillToken(tm, 'maps'),
      });
    case 'reminder':
      return tm(content.templates.reminder, {
        first: ctx.first,
        dayTime: fillToken(tm, 'dayTime'),
      });
    case 'aftercare':
      return tm(content.templates.aftercare, { first: ctx.first });
    case 'followUp':
      return tm(content.templates.followUp, { first: ctx.first, interest: ctx.interest });
    case 'review':
      return reviewRequestText(tm, ctx.first, fillToken(tm, 'reviewLink'));
  }
}

/**
 * The Review template's message — "Thank you for visiting us, Bhooshan! … <review link>" — in
 * the message language `tm` speaks: the composer fills the link's placeholder, the Payment
 * received view the branch's link itself (`feat-payment-celebration` D12) — one text, two places.
 */
export function reviewRequestText(
  tm: TFunction,
  first: string,
  reviewLink: string,
): string {
  return tm(content.templates.review, { first, reviewLink });
}

/** The "Explain <term>" chip's message (`_patterns.md:182`). */
export function explainText(ctx: MessageContext): string {
  const offering = ctx.offering ?? { name: ctx.interest, price: '', sessions: 1 };
  return ctx.tm(content.explain, {
    offering: offering.name,
    results:
      offering.sessions > 1
        ? ctx.tm(content.sessions, { n: offering.sessions })
        : ctx.tm(content.fewWeeks),
  });
}

/** The "day time" fill-in: their next visit's date and time, else "tomorrow at 11 am" (H:5749). */
function dayTimeValue(ctx: MessageContext): string {
  const visit = ctx.upcoming;
  if (visit?.when.kind !== 'instant') return ctx.tm(content.dayTimeFallback);
  const { at } = visit.when;
  return ctx.tm(content.dayTime, {
    day: ctx.clock.date(ctx.clock.dayOf(at)),
    time: ctx.clock.time(at),
  });
}

/** Each fill-in placeholder's name (as the message shows it) and the clinic's value for it. */
export function fillValues(
  ctx: MessageContext,
  values: { address: string; reviewLink: string },
): Record<string, string> {
  const { tm } = ctx;
  return {
    [tm(content.fill.address)]: values.address,
    [tm(content.fill.maps)]: ctx.mapsLink,
    [tm(content.fill.dayTime)]: dayTimeValue(ctx),
    [tm(content.fill.reviewLink)]: values.reviewLink,
  };
}

// ── Suggestions ──

/** A smart chip (`_patterns.md:180`). */
type SmartChipKind = 'price' | 'slots' | 'location' | 'explain' | 'greet' | 'followUp';

/** A smart chip: what it offers, the word it explains, whether their message asked for it. */
export interface SmartChip {
  kind: SmartChipKind;
  term?: string;
  /** Picked from their message (the tooltip says why), not the fallback set. */
  asked: boolean;
}

/** Their message's words that pick a chip (H:5744–5747). */
const ASKED_PRICE = /price|cost|charge|kitna|rate|how much/;
const ASKED_TIMING = /slot|book|appointment|time|when|available|today|tomorrow/;
const ASKED_PLACE = /where|address|location|map/;
const ASKED_TREATMENT = /prp|hair|laser|lhr|peel|facial|acne|pigment/;
const TREATMENT_TERM = /prp|hair fall|laser|lhr|peel|facial|acne|pigment\w*/;

/**
 * The chips their last message calls for — price, timing, place and
 * treatment words — else "Greet" · "Offer 2 slots" · "Follow up" (H:5744–5748).
 */
export function smartChips(lastFrom: ChatMessage | null): SmartChip[] {
  const text = (lastFrom?.body ?? '').toLowerCase();
  const chips: SmartChip[] = [];
  if (ASKED_PRICE.test(text)) chips.push({ kind: 'price', asked: true });
  if (ASKED_TIMING.test(text)) chips.push({ kind: 'slots', asked: true });
  if (ASKED_PLACE.test(text)) chips.push({ kind: 'location', asked: true });
  if (ASKED_TREATMENT.test(text)) {
    chips.push({
      kind: 'explain',
      term: TREATMENT_TERM.exec(text)?.[0] ?? 'treatment',
      asked: true,
    });
  }
  if (chips.length) return chips;
  return [
    { kind: 'greet', asked: false },
    { kind: 'slots', asked: false },
    { kind: 'followUp', asked: false },
  ];
}

/** Each chip's look (`_patterns.md:180`). */
const SMART_CHIP_LOOKS: Readonly<Record<SmartChipKind, { tone: Tone; icon: AppIcon }>> = {
  price: { tone: 'butter', icon: Wallet },
  slots: { tone: 'sky', icon: Calendar },
  location: { tone: 'lav', icon: MapPin },
  explain: { tone: 'mint', icon: Sparkles },
  greet: { tone: 'sage', icon: WhatsAppMark },
  followUp: { tone: 'butter', icon: Phone },
};

/** The message a chip fills in: its template's, or the explanation. */
function smartChipText(chip: SmartChip, ctx: MessageContext): string {
  switch (chip.kind) {
    case 'price':
      return templateText('price', ctx);
    case 'slots':
      return templateText('slots', ctx);
    case 'location':
      return templateText('location', ctx);
    case 'explain':
      return explainText(ctx);
    case 'greet':
      return templateText('greeting', ctx);
    case 'followUp':
      return templateText('followUp', ctx);
  }
}

/** A smart chip as the suggestions popover draws it (28px pill, 13px icon, 12px/600). */
export interface ComposerSuggestion {
  key: string;
  label: string;
  /** Its tooltip: why it is offered, or the message it fills in. */
  hint: string;
  tone: Tone;
  icon: AppIcon;
  text: string;
}

/** A template row (24px tone tile, name, one-line preview). */
export interface ComposerTemplate {
  key: string;
  name: string;
  text: string;
  tone: Tone;
  icon: AppIcon;
}

/**
 * The popover's smart chips (`_patterns.md:180`): labels in the screen's
 * language, messages in the patient's; a chip their message asked for says
 * why ("They asked about price"), the rest preview their message.
 */
export function composerSuggestions(
  lastFrom: ChatMessage | null,
  ctx: MessageContext,
  t: TFunction,
): ComposerSuggestion[] {
  return smartChips(lastFrom).map((chip) => {
    const text = smartChipText(chip, ctx);
    let hint = text;
    if (chip.asked && chip.kind === 'price') hint = t(keys.chips.priceHint);
    if (chip.asked && chip.kind === 'slots') hint = t(keys.chips.slotsHint);
    return {
      key: chip.kind,
      label:
        chip.kind === 'explain'
          ? t(keys.chips.explain, { term: chip.term })
          : t(keys.chips[chip.kind]),
      hint,
      text,
      ...SMART_CHIP_LOOKS[chip.kind],
    };
  });
}

/** The eight template rows (`_patterns.md:181`), named in the screen's language. */
export function composerTemplates(ctx: MessageContext, t: TFunction): ComposerTemplate[] {
  return TEMPLATES.map(({ kind, tone, icon }) => ({
    key: kind,
    name: t(keys.templates[kind]),
    text: templateText(kind, ctx),
    tone,
    icon,
  }));
}

/** The search after a leading "/" ("/pri" → "pri"); null unless the box holds just that (H:5750). */
export function slashQuery(text: string): string | null {
  return /^\/\S*$/.test(text) ? text.slice(1).toLowerCase() : null;
}

/** Whether a template matches the "/" search: its name or its message. */
export function templateMatches(query: string, name: string, text: string): boolean {
  return !query || `${name} ${text}`.toLowerCase().includes(query);
}

/** One "{{…}}" placeholder: where it starts and ends, and its trimmed name. */
interface Placeholder {
  start: number;
  end: number;
  name: string;
}

/** Every placeholder in a message, in order — a linear scan, no backtracking pattern. */
function placeholdersIn(text: string): Placeholder[] {
  const found: Placeholder[] = [];
  let start = text.indexOf('{{');
  while (start >= 0) {
    const close = text.indexOf('}}', start + 2);
    if (close < 0) break;
    const inner = text.slice(start + 2, close);
    if (!inner.includes('}')) found.push({ start, end: close + 2, name: inner.trim() });
    start = text.indexOf('{{', close + 2);
  }
  return found;
}

/** The fill-in placeholders a message holds, in order ("address", "maps link"). */
export function templateVariables(text: string): string[] {
  return placeholdersIn(text)
    .map((placeholder) => placeholder.name)
    .filter(Boolean);
}

/**
 * Fill the first remaining placeholder with the clinic's value for it (or its
 * own name when the clinic has none) — what every "Fill in" chip does (H:5750).
 */
export function fillFirstVariable(
  text: string,
  values: Readonly<Record<string, string>>,
): string {
  const [first] = placeholdersIn(text);
  if (!first) return text;
  const value = values[first.name] || first.name; // NOSONAR(S6606): a blank clinic value ("") keeps the placeholder's name
  return text.slice(0, first.start) + value + text.slice(first.end);
}

// ── Lookups for the host's record ──

/** Their interest in the message language, else "your treatment". */
export function interestPhrase(
  interests: readonly LeadInterest[] | undefined,
  tm: TFunction,
): string {
  const first = interests?.find((interest) => interest !== 'others');
  return first ? tm(content.interests[first]) : tm(content.yourTreatment);
}

/**
 * The offering their interest names — the first whose name holds the
 * interest's first word — else the catalogue's first (H:5742).
 */
export function offeringFor<T extends { name: string }>(
  offerings: readonly T[],
  interest: string,
): T | null {
  const word = interest.split(/\s+/)[0]?.toLowerCase() ?? '';
  return (
    (word
      ? offerings.find((offering) => offering.name.toLowerCase().includes(word))
      : undefined) ??
    offerings[0] ??
    null
  );
}
