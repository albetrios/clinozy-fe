import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import type { LeadMessage } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicClockTime, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { ContactHistoryEntry } from '@/shared/api/clinic/messages-contracts.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import { CHAT_COLUMN_NS } from './chat-column.constants.ts';
import {
  bookingReason,
  type ChatContact,
  chatContactOfLead,
  composerModes,
  composerShowsLabels,
  composerSuggestions,
  composerTemplates,
  deliveryView,
  emptyLine,
  explainText,
  fillFirstVariable,
  fillValues,
  initialComposerMode,
  interestPhrase,
  lastInbound,
  type MessageContext,
  offeringFor,
  preferenceWarning,
  replyHint,
  slashQuery,
  smartChips,
  starters,
  starterSet,
  templateMatches,
  templateText,
  templateVariables,
  visitSummary,
} from './chat-composer.ts';
import type { ChatClock } from './chat-history.ts';

const t = i18n.getFixedT('en', CHAT_COLUMN_NS);
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

/** The clinic clock on 3 Oct 2026, writing times as the design does. */
const clock: ChatClock = {
  today: '2026-10-03',
  dayOf: (instant) => clinicToday(new Date(instant)),
  time: (instant) => {
    const [hour = 0, minute = 0] = clinicClockTime(new Date(instant))
      .split(':')
      .map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
  },
  shortTime: (instant) => {
    const [hour = 0, minute = 0] = clinicClockTime(new Date(instant))
      .split(':')
      .map(Number);
    const minutes = minute ? `:${String(minute).padStart(2, '0')}` : '';
    return `${hour % 12 || 12}${minutes} ${hour < 12 ? 'am' : 'pm'}`;
  },
  date: (date) => {
    const [, month = 1, day] = date.split('-').map(Number);
    return `${day} ${MONTHS[month - 1]}`;
  },
};

let sequence = 0;
function message(fields: Partial<LeadMessage>): LeadMessage {
  sequence += 1;
  return {
    organizationId: '00000000-0000-4000-8000-0000000c1a10',
    createdAt: '2026-10-03T04:00:00.000Z',
    updatedAt: '2026-10-03T04:00:00.000Z',
    createdById: '00000000-0000-4000-8000-0000000a0001',
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    leadId: '00000000-0000-4000-8000-000000000100',
    channel: 'whatsapp',
    direction: 'received',
    body: 'Hello',
    deliveryStatus: 'delivered',
    isSystem: false,
    authorId: null,
    taskId: null,
    sentAt: '2026-10-03T04:00:00.000Z',
    ...fields,
  };
}

const ANAYA: ChatContact = {
  name: 'Anaya Desai',
  phone: '+919879521034',
  isPatient: false,
};

function visit(
  at: string,
  status: 'scheduled' | 'checked_in' | 'completed' = 'scheduled',
) {
  return {
    kind: 'appointment',
    id: '00000000-0000-4000-8000-000000000200',
    when: { kind: 'instant', at },
    sortAt: at,
    seq: 2859,
    service: 'Hydrafacial',
    status,
    doctorName: null,
  } satisfies ContactHistoryEntry;
}

function contextWith(fields: Partial<MessageContext> = {}): MessageContext {
  return {
    tm: t,
    clock,
    first: 'Anaya',
    me: { first: 'Riya', short: 'Riya S.' },
    clinic: 'Cresence Skin',
    mapsLink: 'maps.app.goo.gl/cresence',
    offering: { name: 'LHR Full Face', price: '₹4,800', sessions: 6 },
    interest: 'LHR',
    freeSlots: [
      { date: '2026-10-03', time: '16:00' },
      { date: '2026-10-04', time: '12:30' },
    ],
    upcoming: null,
    ...fields,
  };
}

describe('"Send via" (KICKOFF §3.5)', () => {
  it('offers WhatsApp only when the contact is on it, and Instagram only with a handle', () => {
    expect(composerModes(ANAYA)).toEqual([
      { mode: 'whatsapp', disabled: false },
      { mode: 'instagram', disabled: true },
      { mode: 'call', disabled: false },
      { mode: 'note', disabled: false },
    ]);
    expect(
      composerModes({ ...ANAYA, onWhatsApp: false, instagram: '@anaya' }).map(
        (option) => [option.mode, option.disabled],
      ),
    ).toEqual([
      ['instagram', false],
      ['call', false],
      ['note', false],
    ]);
  });

  it('opens on their last message’s channel, then ours, then the default (leads.md:36)', () => {
    const insta = { ...ANAYA, instagram: '@anaya' };
    expect(
      initialComposerMode(
        [
          message({ channel: 'whatsapp', direction: 'sent' }),
          message({ channel: 'instagram', direction: 'received' }),
          message({ channel: 'note', direction: 'sent' }),
        ],
        insta,
      ),
    ).toBe('instagram');
    expect(
      initialComposerMode([message({ channel: 'instagram', direction: 'sent' })], insta),
    ).toBe('instagram');
    expect(initialComposerMode([], { ...ANAYA, defaultChannel: 'call' })).toBe('call');
    expect(initialComposerMode([], ANAYA)).toBe('whatsapp');
  });

  it('falls back when the wanted tab can’t be picked', () => {
    const lastOnInstagram = [message({ channel: 'instagram', direction: 'received' })];
    expect(initialComposerMode(lastOnInstagram, ANAYA)).toBe('whatsapp');
    expect(initialComposerMode(lastOnInstagram, { ...ANAYA, onWhatsApp: false })).toBe(
      'call',
    );
  });

  it.each([
    [1440, 420, false],
    [1440, 680, true],
    [1440, 459, false],
    [1300, 680, false],
    [375, 680, false],
  ])('shows the labels at %ipx wide with a %ipx chat: %s (H:5770)', (vw, pref, shown) => {
    expect(composerShowsLabels(vw, pref)).toBe(shown);
  });
});

describe('the notes beside the tabs', () => {
  const fromInstagram = message({ channel: 'instagram', direction: 'received' });

  it('says where they last wrote, or offers to switch', () => {
    expect(replyHint(fromInstagram, 'instagram')).toEqual({ kind: 'here' });
    expect(replyHint(fromInstagram, 'whatsapp')).toEqual({
      kind: 'mismatch',
      channel: 'instagram',
    });
    expect(replyHint(fromInstagram, 'note')).toBeNull();
    expect(replyHint(fromInstagram, 'call')).toBeNull();
    expect(replyHint(null, 'whatsapp')).toBeNull();
  });

  it('warns about their preferences (_patterns.md:166)', () => {
    expect(preferenceWarning('call', ['No calls'])).toBe('noCalls');
    expect(preferenceWarning('whatsapp', ['No calls'])).toBeNull();
    expect(preferenceWarning('whatsapp', ['No calls', 'After 6 pm'])).toBe('afterSix');
    expect(preferenceWarning('call', ['No calls', 'After 6 pm'])).toBe('noCalls');
    expect(preferenceWarning('note')).toBeNull();
  });

  it('reads the booking reason from their last message, 80 characters at most (H:5751)', () => {
    const long = message({ body: 'x'.repeat(120) });
    expect(bookingReason(long)).toHaveLength(80);
    expect(bookingReason(lastInbound([message({ body: 'Is Saturday possible?' })]))).toBe(
      'Is Saturday possible?',
    );
    expect(bookingReason(null)).toBeNull();
  });
});

describe('delivery labels (D22)', () => {
  const sent = (fields: Partial<LeadMessage>) =>
    message({ direction: 'sent', channel: 'whatsapp', ...fields });

  it('reads a queued message "Sending…", or "Queued" while WhatsApp is down', () => {
    expect(deliveryView(sent({ deliveryStatus: 'queued' }), false)).toEqual({
      kind: 'sending',
    });
    expect(deliveryView(sent({ deliveryStatus: 'queued' }), true)).toEqual({
      kind: 'status',
      status: 'queued',
    });
    expect(
      deliveryView(sent({ channel: 'instagram', deliveryStatus: 'queued' }), true),
    ).toEqual({ kind: 'sending' });
  });

  it('labels the provider’s states and a failure', () => {
    expect(deliveryView(sent({ deliveryStatus: 'read' }), false)).toEqual({
      kind: 'status',
      status: 'read',
    });
    expect(deliveryView(sent({ deliveryStatus: 'failed' }), false)).toEqual({
      kind: 'failed',
    });
  });

  it('says nothing for their messages, notes, call logs or system lines', () => {
    expect(deliveryView(message({ direction: 'received' }), false)).toEqual({
      kind: 'none',
    });
    expect(deliveryView(sent({ channel: 'note' }), false)).toEqual({ kind: 'none' });
    expect(deliveryView(sent({ channel: 'call' }), false)).toEqual({ kind: 'none' });
    expect(deliveryView(sent({ isSystem: true }), false)).toEqual({ kind: 'none' });
  });
});

describe('the empty card and its starters (_patterns.md:171–178)', () => {
  it('picks the set from their visits', () => {
    const today = visitSummary([visit('2026-10-03T10:30:00.000Z')], clock);
    expect(starterSet(today, clock)).toBe('visitToday');
    const arrived = visitSummary(
      [visit('2026-10-03T10:30:00.000Z', 'checked_in')],
      clock,
    );
    expect(starterSet(arrived, clock)).toBe('visitLater');
    const later = visitSummary([visit('2026-10-09T10:30:00.000Z')], clock);
    expect(starterSet(later, clock)).toBe('visitLater');
    const past = visitSummary([visit('2026-09-28T10:30:00.000Z', 'completed')], clock);
    expect(starterSet(past, clock)).toBe('pastVisits');
    expect(starterSet(visitSummary([], clock), clock)).toBe('noVisits');
  });

  it('writes the line for a coming visit, past visits only, and none', () => {
    const later = visitSummary([visit('2026-10-04T05:30:00.000Z')], clock);
    // Each data token isolated, so a right-to-left page keeps "11:00 am" whole.
    expect(emptyLine('visitLater', t, 'Dharti', later.upcoming, clock)).toBe(
      `${fsi('Dharti')}’s ${fsi('Hydrafacial')} is ${fsi('tomorrow')} at ${fsi('11:00 am')} · a quick WhatsApp keeps the slot`,
    );
    const far = visitSummary([visit('2026-10-09T10:30:00.000Z')], clock);
    // The date inside "on 9 Oct" too.
    const onDate = `on ${fsi('9 Oct')}`;
    expect(emptyLine('visitLater', t, 'Dharti', far.upcoming, clock)).toBe(
      `${fsi('Dharti')}’s ${fsi('Hydrafacial')} is ${fsi(onDate)} at ${fsi('4:00 pm')} · a quick WhatsApp keeps the slot`,
    );
    expect(emptyLine('pastVisits', t, 'Dharti', null, clock)).toBe(
      `Every WhatsApp, call and note with ${fsi('Dharti')} shows here`,
    );
    expect(emptyLine('noVisits', t, 'Dharti', null, clock)).toBe(
      'Start with a WhatsApp · replies land here',
    );
  });

  it('fills each starter from the visit and the clinic’s settings, never a literal', () => {
    const today = visitSummary([visit('2026-10-03T10:30:00.000Z')], clock);
    const ctx = contextWith({ upcoming: today.upcoming });
    expect(starters('visitToday', t, ctx)).toEqual([
      {
        key: 'onTheWay',
        label: 'Are you on your way?',
        text: 'Hi Anaya, we are ready for your Hydrafacial at 4:00 pm. Are you on your way?',
      },
      {
        key: 'directions',
        label: 'Send directions',
        text: 'Hi Anaya, here is the clinic location: maps.app.goo.gl/cresence. See you at 4:00 pm!',
      },
      {
        key: 'newTime',
        label: 'Offer a new time',
        text: 'Hi Anaya, if 4:00 pm does not work today, reply with a time that suits you and we will move it.',
      },
    ]);
    const later = visitSummary([visit('2026-10-04T05:30:00.000Z')], clock);
    expect(
      starters('visitLater', t, contextWith({ upcoming: later.upcoming })).map(
        (starter) => starter.text,
      ),
    ).toEqual([
      'Hi Anaya, a reminder of your Hydrafacial tomorrow at 11:00 am. Reply Yes to confirm.',
      'Hi Anaya, before your Hydrafacial tomorrow: come without makeup and avoid sun for 24 hours. See you at 11:00 am!',
      'Hi Anaya, here is the clinic location: maps.app.goo.gl/cresence. See you tomorrow at 11:00 am.',
    ]);
    expect(starters('pastVisits', t, ctx).map((starter) => starter.label)).toEqual([
      'Ask how it went',
      'Book the next session',
      'Share an offer',
    ]);
    expect(starters('noVisits', t, ctx).map((starter) => starter.text)).toEqual([
      'Hi Anaya, this is Riya S. from Cresence Skin. Happy to help with anything you need.',
      'Hi Anaya, our doctor can see you this week. Shall I book a consultation?',
      'Hi Anaya, here is the clinic location: maps.app.goo.gl/cresence.',
    ]);
  });
});

describe('suggestions (_patterns.md:179–182)', () => {
  it('picks smart chips from their last message, else the fallback set', () => {
    const asked = message({
      body: 'What is the price for PRP and when are you available? Where is the clinic?',
    });
    expect(smartChips(asked)).toEqual([
      { kind: 'price', asked: true },
      { kind: 'slots', asked: true },
      { kind: 'location', asked: true },
      { kind: 'explain', term: 'prp', asked: true },
    ]);
    expect(
      smartChips(message({ body: 'Is Saturday possible?' })).map((chip) => chip.kind),
    ).toEqual(['greet', 'slots', 'followUp']);
    expect(smartChips(null).map((chip) => chip.kind)).toEqual([
      'greet',
      'slots',
      'followUp',
    ]);
  });

  it('labels the chips and says why one was offered', () => {
    const chips = composerSuggestions(
      message({ body: 'how much for laser?' }),
      contextWith(),
      t,
    );
    expect(
      chips.map((chip) => [chip.label, chip.hint === chip.text ? 'text' : chip.hint]),
    ).toEqual([
      ['Share price', 'They asked about price'],
      ['Explain laser', 'text'],
    ]);
    expect(chips[1]?.text).toBe(
      'Great question! LHR Full Face works well for this — most people see results in 6 sessions. The doctor will check and plan it at your consultation.',
    );
  });

  it('writes the eight templates verbatim, placeholders kept for "Fill in"', () => {
    const ctx = contextWith();
    expect(
      composerTemplates(ctx, t).map((template) => [template.name, template.text]),
    ).toEqual([
      [
        'Greeting',
        'Hi Anaya, this is Riya from Cresence Skin 😊 How can I help you today?',
      ],
      [
        'Price',
        'LHR Full Face is ₹4,800 for 6 sessions. It includes a consultation with the doctor. Shall I book you in?',
      ],
      [
        'Free slots',
        'We have today 4 pm or tomorrow 12:30 pm open for LHR. Which one suits you?',
      ],
      [
        'Location',
        'We are at {{address}} · Google Maps: {{maps link}}. Parking is available right outside.',
      ],
      [
        'Reminder',
        'Hi Anaya, a reminder of your visit {{day time}}. Reply Yes to confirm or tell us a better time.',
      ],
      [
        'Aftercare',
        'Hi Anaya, how is the skin feeling today? Keep it moisturised, use sunscreen and avoid scrubs for 48 hours.',
      ],
      [
        'Follow-up',
        'Hi Anaya, just checking in about LHR. Would you like me to hold a slot for you this week?',
      ],
      [
        'Review',
        'Thank you for visiting us, Anaya! If you loved it, a quick Google review helps us a lot: {{review link}}',
      ],
    ]);
  });

  it('quotes a one-session offering without "for <n> sessions", and explains it in weeks', () => {
    const single = contextWith({
      offering: { name: 'Underarm Peel', price: '₹1,500', sessions: 1 },
    });
    expect(templateText('price', single)).toBe(
      'Underarm Peel is ₹1,500. It includes a consultation with the doctor. Shall I book you in?',
    );
    expect(explainText(single)).toContain('most people see results in a few weeks');
  });

  it('offers tomorrow 11 am and 4 pm when no slot is free (H:5741)', () => {
    expect(templateText('slots', contextWith({ freeSlots: [] }))).toBe(
      'We have tomorrow 11 am or tomorrow 4 pm open for LHR. Which one suits you?',
    );
  });

  it('searches templates after a leading "/"', () => {
    expect(slashQuery('/Loc')).toBe('loc');
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/loc ation')).toBeNull();
    expect(slashQuery('Hi /loc')).toBeNull();
    expect(templateMatches('loc', 'Location', 'We are at…')).toBe(true);
    expect(templateMatches('parking', 'Location', 'Parking is available')).toBe(true);
    expect(templateMatches('zzz', 'Location', 'We are at…')).toBe(false);
  });
});

describe('fill-ins (H:5749–5750)', () => {
  // Built per test: the `clinic` copy loads in the suite's beforeAll, after collection.
  let ctx: MessageContext;
  let values: Record<string, string>;
  beforeEach(() => {
    ctx = contextWith({
      upcoming: visitSummary([visit('2026-10-09T10:30:00.000Z')], clock).upcoming,
    });
    values = fillValues(ctx, {
      address: '3rd floor, Shree Hari Complex, Adajan, Surat',
      reviewLink: 'g.page/r/cresence/review',
    });
  });

  it('lists the placeholders a message holds', () => {
    expect(
      templateVariables(
        'We are at {{address}} · Google Maps: {{ maps link }}. {{}} {{a}b}}',
      ),
    ).toEqual(['address', 'maps link']);
  });

  it('fills the first remaining placeholder with the clinic’s value, one at a time', () => {
    const text = templateText('location', ctx);
    const once = fillFirstVariable(text, values);
    expect(once).toBe(
      'We are at 3rd floor, Shree Hari Complex, Adajan, Surat · Google Maps: {{maps link}}. Parking is available right outside.',
    );
    expect(fillFirstVariable(once, values)).toBe(
      'We are at 3rd floor, Shree Hari Complex, Adajan, Surat · Google Maps: maps.app.goo.gl/cresence. Parking is available right outside.',
    );
    expect(fillFirstVariable('Plain', values)).toBe('Plain');
  });

  it('writes their next visit as "day time", else "tomorrow at 11 am"', () => {
    expect(values['day time']).toBe('9 Oct at 4:00 pm');
    expect(fillValues(contextWith(), { address: '', reviewLink: '' })['day time']).toBe(
      'tomorrow at 11 am',
    );
  });

  it('keeps an unknown placeholder’s own name', () => {
    expect(fillFirstVariable('See {{parking spot}}', values)).toBe('See parking spot');
  });
});

describe('the record’s interest and offering', () => {
  it('names their first interest in the message language, skipping "Others"', () => {
    expect(interestPhrase(['others', 'lhr'], t)).toBe('LHR');
    expect(interestPhrase([], t)).toBe('your treatment');
    expect(interestPhrase(undefined, t)).toBe('your treatment');
  });

  it('finds the offering its interest names, else the catalogue’s first (H:5742)', () => {
    const catalogue = [{ name: 'B1G1 D-Tan Facial' }, { name: 'LHR Full Face' }];
    expect(offeringFor(catalogue, 'LHR')?.name).toBe('LHR Full Face');
    expect(offeringFor(catalogue, 'your treatment')?.name).toBe('B1G1 D-Tan Facial');
    expect(offeringFor([], 'LHR')).toBeNull();
  });
});

describe('chatContactOfLead (D32)', () => {
  it('reads the lead’s contact fields, or its one mobile on WhatsApp', () => {
    expect(
      chatContactOfLead({
        name: 'Kabir Mehta',
        phone: '+919812345678',
        patientId: null,
        contact: undefined,
        interests: ['lhr'],
      }),
    ).toEqual({
      name: 'Kabir Mehta',
      phone: '+919812345678',
      isPatient: false,
      onWhatsApp: true,
      instagram: null,
      defaultChannel: null,
      preferences: [],
      interests: ['lhr'],
    });
  });
});
