import {
  PROTOTYPE_SEED_DAY,
  seedCommon,
  seedInstant,
} from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type {
  Channel,
  DeliveryStatus,
  LeadInterest,
  LeadMessage,
  LeadSource,
  LeadStatus,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';

import { branchRef, MAIN_BRANCH } from './organization.fixtures.ts';
import { patientRef } from './patients.fixtures.ts';
import {
  bookedOn,
  must,
  readSeedLabel,
  ref,
  secondsLater,
  seedAt,
  seedMobile,
} from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

const STATUSES: Record<string, LeadStatus> = {
  New: 'new',
  Contacted: 'contacted',
  'Follow-up': 'follow_up',
  'Clinic visited': 'clinic_visited',
  'No response': 'no_response',
  'Not interested': 'not_interested',
  Invalid: 'invalid',
  Lost: 'lost',
};
const SOURCES: Record<string, LeadSource> = {
  Instagram: 'instagram',
  Google: 'google',
  WhatsApp: 'whatsapp',
  Facebook: 'facebook',
  'Walk-in': 'walk_in',
  Referral: 'referral',
  'Re-target': 'retarget',
};
const INTERESTS: Record<string, LeadInterest> = {
  Others: 'others',
  Clinical: 'clinical',
  Peel: 'peel',
  LHR: 'lhr',
  Hydrafacial: 'hydrafacial',
  PRP: 'prp',
};
/** The prototype's channel keys (`CHN` H:3364). */
const CHANNELS: Record<string, Channel> = {
  wa: 'whatsapp',
  ig: 'instagram',
  sms: 'sms',
  call: 'call',
  email: 'email',
};

interface LeadRow {
  seq: number;
  name: string;
  phone: string;
  status: string;
  source: string;
  interests: readonly string[];
  owner: StaffKey;
  /** Created (prototype label). */
  at: string;
  /** Re-target leads: `rtWhy`. */
  retarget?: string;
  /** The linked patient, by name — the prototype's codes collide (#3504 is Aayush Thakkar). */
  patient?: string;
  followUp?: string;
}

/**
 * `LEADROWS` (H:3376–3394), verbatim, with its one patch applied (H:3395:
 * #2362 is Asha's, in Follow-up). Only #2360 has a follow-up date the seeds
 * state ("Will call Monday", H:3404); the prototype's others are a hash.
 */
const LEAD_ROWS: readonly LeadRow[] = [
  {
    seq: 2371,
    name: 'Kavya Joshi',
    phone: '+91 97250 33418',
    status: 'New',
    source: 'Re-target',
    interests: ['LHR'],
    owner: 'NK',
    at: 'Today 07:00',
    retarget: 'No visit for 148 days · LHR 3 of 6 sessions left',
    patient: 'Kavya Joshi',
  },
  {
    seq: 2370,
    name: 'Nirali Mehta',
    phone: '+91 99090 41276',
    status: 'Contacted',
    source: 'Re-target',
    interests: ['Clinical'],
    owner: 'NK',
    at: 'Yesterday',
    retarget: 'No visit for 162 days · acne follow-up overdue',
    patient: 'Nirali Mehta',
  },
  {
    seq: 2210,
    name: 'Rhea Shah',
    phone: '+91 98250 11241',
    status: 'Clinic visited',
    source: 'Instagram',
    interests: ['LHR'],
    owner: 'NK',
    at: '28 Jun',
    patient: 'Rhea Shah',
  },
  {
    seq: 2365,
    name: 'Rhea Shah',
    phone: '+91 98250 11241',
    status: 'New',
    source: 'WhatsApp',
    interests: ['PRP'],
    owner: 'RS',
    at: 'Today 09:20',
    patient: 'Rhea Shah',
  },
  {
    seq: 2364,
    name: 'Kabir Mehta',
    phone: '+91 99250 44710',
    status: 'Contacted',
    source: 'Instagram',
    interests: ['PRP'],
    owner: 'NK',
    at: 'Today 09:58',
  },
  {
    seq: 2363,
    name: 'Anaya Desai',
    phone: '+91 98795 21034',
    status: 'New',
    source: 'WhatsApp',
    interests: ['Clinical'],
    owner: 'RS',
    at: 'Today 10:28',
  },
  {
    seq: 2362,
    name: 'Poonam Balar',
    phone: '+91 33333 33333',
    status: 'Follow-up',
    source: 'Instagram',
    interests: ['Others'],
    owner: 'AS',
    at: 'Yesterday 3:30 pm',
  },
  {
    seq: 2361,
    name: 'Online Con',
    phone: '+91 88496 26253',
    status: 'New',
    source: 'Google',
    interests: ['Clinical'],
    owner: 'DD',
    at: 'Yesterday 11:44 am',
  },
  {
    seq: 2360,
    name: 'Alpa Bambhroliya',
    phone: '+91 87804 23549',
    status: 'Follow-up',
    source: 'WhatsApp',
    interests: ['Others'],
    owner: 'DR',
    at: 'Yesterday 10:38 am',
    followUp: '28 Sep · 11:00',
  },
  {
    seq: 2359,
    name: 'Rutvik Kathiriya',
    phone: '+91 99137 18096',
    status: 'Follow-up',
    source: 'Google',
    interests: ['Others'],
    owner: 'DR',
    at: 'Yesterday 10:32 am',
  },
  {
    seq: 2358,
    name: 'Rohit Solanki',
    phone: '+91 22222 22222',
    status: 'Follow-up',
    source: 'Instagram',
    interests: ['Peel'],
    owner: 'DD',
    at: '25 Sep 12:15 pm',
  },
  {
    seq: 2357,
    name: 'Najmus',
    phone: '+91 90999 89281',
    status: 'Contacted',
    source: 'Facebook',
    interests: ['Others'],
    owner: 'DR',
    at: '25 Sep 10:41 am',
  },
  {
    seq: 2356,
    name: 'Mehul Solanki',
    phone: '+91 87808 91089',
    status: 'No response',
    source: 'WhatsApp',
    interests: ['Others'],
    owner: 'RS',
    at: '24 Sep 4:34 pm',
  },
  {
    seq: 2355,
    name: 'Raghuvirsinh Vaghela',
    phone: '+91 96624 15101',
    status: 'Clinic visited',
    source: 'WhatsApp',
    interests: ['LHR'],
    owner: 'RS',
    at: '24 Sep 3:44 pm',
    patient: 'Raghuvirsinh Vaghela',
  },
  {
    seq: 2354,
    name: 'Akshar Gajera',
    phone: '+91 93279 65209',
    status: 'Follow-up',
    source: 'WhatsApp',
    interests: ['Others'],
    owner: 'RS',
    at: '24 Sep 3:10 pm',
  },
  {
    seq: 2353,
    name: 'Tulsi',
    phone: '+91 70162 92085',
    status: 'Not interested',
    source: 'WhatsApp',
    interests: ['LHR'],
    owner: 'RS',
    at: '24 Sep 11:45 am',
  },
  {
    seq: 2352,
    name: 'Dharti Galani',
    phone: '+91 82006 03212',
    status: 'Clinic visited',
    source: 'Instagram',
    interests: ['Peel', 'Clinical'],
    owner: 'NK',
    at: '16 Aug',
    patient: 'Dharti Galani',
  },
];

/** `LEMAIL` (H:3365). */
const EMAILS: Record<number, string> = {
  2360: 'alpa.b@gmail.com',
  2352: 'dharti.g@gmail.com',
  2357: 'najmus@outlook.com',
};

/** `unread` (H:3384–3385): the messages nobody has read yet; every other lead is read. */
const UNREAD: Record<number, number> = { 2365: 1, 2363: 2 };

/** `COLLAB` (H:3375): who else is on the lead. */
const INVOLVED: Record<number, readonly StaffKey[]> = {
  2363: ['NK'],
  2364: ['RS'],
  2360: ['RS', 'DD'],
  2358: ['NK'],
  2352: ['RS'],
};

interface ContactThreadRow {
  seq: number;
  name: string;
  phone: string;
  /** The patient whose chat-only thread this is. */
  patient?: string;
  /**
   * When the thread opened (prototype label) — or, as an ISO date, the
   * person's first visit: the thread opened when that visit was booked.
   */
  at: string;
}

/**
 * Chat-only threads (`kind = contact_thread`, D32): the two patient threads of
 * `THREADS` (H:3477–3481; the two lead threads there are #2363 / #2364 again),
 * then one per appointment-only person — the prototype books them as neither
 * patient nor lead ("Contact · chat only · no lead", H:5785), and the contract
 * stores such a contact as a contact thread (`S:1609`). Vikram Bhatt (a
 * no-show in `TASKS`) and Faizan Shaikh (a first visit on Today) have no number
 * in any seed, so theirs is a placeholder.
 */
const CONTACT_THREADS: readonly ContactThreadRow[] = [
  {
    seq: 2372,
    name: 'Neha Gupta',
    phone: '+91 97140 88213',
    patient: 'Neha Gupta',
    at: 'Yesterday · 10:00',
  },
  {
    seq: 2373,
    name: 'Pooja Nair',
    phone: '+91 98240 11562',
    patient: 'Pooja Nair',
    at: 'Yesterday · 10:00',
  },
  { seq: 2374, name: 'Kinjal Vora', phone: '+91 98795 61220', at: '2026-09-25' },
  { seq: 2375, name: 'Jalpa Sheladiya', phone: '+91 96625 22288', at: '2026-09-28' },
  { seq: 2376, name: 'Ridhi Delvadiya', phone: '+91 98700 74042', at: '2026-09-28' },
  { seq: 2377, name: 'Sandip Jivani', phone: '+91 98798 98045', at: '2026-09-30' },
  { seq: 2378, name: 'Gaytri Jagani', phone: '+91 91069 89223', at: '2026-10-01' },
  { seq: 2379, name: 'Apeksha Patel', phone: '+91 81413 41413', at: '2026-10-02' },
  { seq: 2380, name: 'Dayaben Savaliya', phone: '+91 93163 93646', at: '2026-10-02' },
  { seq: 2381, name: 'Komal Sonani', phone: '+91 95587 17522', at: '2026-10-07' },
  { seq: 2382, name: 'Honey Shingala', phone: '+91 93164 17031', at: '2026-10-08' },
  { seq: 2383, name: 'Nidhi Dhingani', phone: '+91 73594 99218', at: '2026-10-26' },
  { seq: 2384, name: 'Vikram Bhatt', phone: '90000 02384', at: PROTOTYPE_SEED_DAY },
  { seq: 2385, name: 'Faizan Shaikh', phone: '90000 02385', at: PROTOTYPE_SEED_DAY },
];

/** The contact thread of a person who has only appointments (or only a chat). */
export function contactThreadRef(name: string): string {
  return ref.lead(
    must(
      CONTACT_THREADS.find((row) => row.name === name),
      `contact thread ${name}`,
    ).seq,
  );
}

interface MessageRow {
  kind: 'sys' | 'in' | 'out' | 'note';
  text: string;
  at: string;
  status?: DeliveryStatus;
  channel?: string;
}

/**
 * `LDMSGS` (H:3397–3408) and the patient threads of `THREADS` (H:3477–3481),
 * verbatim. A bare time is today; a bare day takes the lead's own time.
 */
const MESSAGES: Record<number, readonly MessageRow[]> = {
  2371: [
    {
      kind: 'sys',
      text: 'Re-target lead created automatically · no visit for 148 days · LHR 3 of 6 sessions left',
      at: '07:00',
    },
    {
      kind: 'out',
      text: 'Hi Kavya, it has been a while since your last LHR session. You have 3 sessions left in your package. Shall we book one this week?',
      at: '07:00',
      status: 'delivered',
      channel: 'wa',
    },
  ],
  2370: [
    {
      kind: 'sys',
      text: 'Re-target lead created automatically · no visit for 162 days',
      at: 'Yesterday',
    },
    {
      kind: 'out',
      text: 'Hi Nirali, your acne follow-up is due. Would you like a slot this week?',
      at: 'Yesterday',
      status: 'read',
      channel: 'wa',
    },
    { kind: 'in', text: 'Yes, maybe Saturday?', at: 'Yesterday', channel: 'wa' },
  ],
  2365: [
    { kind: 'sys', text: 'Existing patient wrote in · new lead linked', at: '09:20' },
    {
      kind: 'in',
      text: 'Hi, I am already doing laser with you. Do you also do PRP for hair fall?',
      at: '09:20',
      channel: 'wa',
    },
  ],
  2363: [
    { kind: 'sys', text: 'Lead created from WhatsApp ad', at: '10:28' },
    {
      kind: 'in',
      text: 'Hi, I have acne scars since 2 years. What is the treatment and price?',
      at: '10:28',
    },
    { kind: 'in', text: 'Is Saturday possible?', at: '10:31' },
  ],
  2364: [
    {
      kind: 'in',
      text: 'Do you do PRP for hair fall? Cost?',
      at: '09:58',
      channel: 'ig',
    },
    {
      kind: 'out',
      text: 'Yes. A counsellor will call you by 11:00 with details.',
      at: '10:04',
      status: 'failed',
      channel: 'ig',
    },
  ],
  2362: [{ kind: 'sys', text: 'Lead created from Instagram', at: '26 Sep' }],
  2360: [
    { kind: 'in', text: 'Pigmentation treatment price?', at: 'Yesterday' },
    {
      kind: 'out',
      text: 'Sharing our price list. Consultation is ₹800.',
      at: 'Yesterday',
      status: 'read',
    },
    { kind: 'note', text: 'Will call Monday', at: 'Yesterday' },
    { kind: 'sys', text: 'Status → Follow-up', at: 'Yesterday' },
  ],
  2358: [
    { kind: 'in', text: 'Is peel good for acne marks?', at: '25 Sep' },
    {
      kind: 'out',
      text: 'Yes, often in a series of 4. The doctor decides after a consultation.',
      at: '25 Sep',
      status: 'delivered',
    },
  ],
  2355: [{ kind: 'sys', text: 'Converted to patient', at: '24 Sep' }],
  2352: [{ kind: 'sys', text: 'Converted to patient', at: '20 Aug' }],
  2372: [
    {
      kind: 'out',
      text: 'Reminder: Laser session Tue 29 Sep, 4:00 pm with Kiran.',
      at: 'Yesterday',
      status: 'read',
    },
    { kind: 'in', text: 'Can I shift it to Thursday evening?', at: '09:47' },
  ],
  2373: [
    {
      kind: 'out',
      text: 'After-care (ગુજરાતી): avoid sun for 48 hours, use the gel twice daily.',
      at: 'Yesterday',
      status: 'delivered',
    },
  ],
};

/** When a contact thread was opened: its first chat, or its first booking. */
const threadOpenedAt = (row: ContactThreadRow, today: string) =>
  /^\d{4}-/.test(row.at)
    ? seedInstant(bookedOn(row.at), '10:00', today)
    : seedAt(row.at, '10:00', today);

function createdLabelOf(seq: number): string {
  const lead = LEAD_ROWS.find((row) => row.seq === seq);
  return lead
    ? lead.at
    : must(
        CONTACT_THREADS.find((row) => row.seq === seq),
        `lead #${seq}`,
      ).at;
}

function sentAt(seq: number, label: string, today: string): string {
  if (/^\d{1,2}:\d{2}$/.test(label)) return seedAt(`Today · ${label}`, '10:00', today);
  const message = readSeedLabel(label);
  const created = readSeedLabel(createdLabelOf(seq));
  const time = message.time ?? (message.date === created.date ? created.time : null);
  return seedInstant(message.date, time ?? '10:00', today);
}

const ownerOf = (seq: number): StaffKey | null =>
  LEAD_ROWS.find((row) => row.seq === seq)?.owner ?? null;

/** Every chat line of the leads and contact threads, oldest first per thread. */
export function leadMessageSeed(today: string = clinicToday()): LeadMessage[] {
  return Object.entries(MESSAGES).flatMap(([key, rows]) => {
    const seq = Number(key);
    const owner = staffRef(ownerOf(seq) ?? 'RS');
    return rows.map((row, index) => {
      const at = secondsLater(sentAt(seq, row.at, today), index);
      const author = row.kind === 'out' || row.kind === 'note' ? owner : null;
      return {
        ...seedCommon(at, author ?? owner),
        id: ref.leadMessage(`${seq}:${index}`),
        leadId: ref.lead(seq),
        channel:
          row.kind === 'sys' || row.kind === 'note'
            ? 'note'
            : must(CHANNELS[row.channel ?? 'wa'], `channel ${row.channel}`),
        direction: row.kind === 'in' ? 'received' : 'sent',
        body: row.text,
        deliveryStatus: row.kind === 'in' ? 'delivered' : (row.status ?? 'sent'),
        isSystem: row.kind === 'sys',
        authorId: author,
        taskId: null,
        sentAt: at,
      } satisfies LeadMessage;
    });
  });
}

/** The latest of a lead's own time and its messages' times. */
function lastTouch(seq: number, createdAt: string, messages: readonly LeadMessage[]) {
  const leadId = ref.lead(seq);
  return messages
    .filter((message) => message.leadId === leadId)
    .reduce(
      (latest, message) => (message.sentAt > latest ? message.sentAt : latest),
      createdAt,
    );
}

/**
 * The plan's fields on a seeded lead (Appendix F): no custom interests, not
 * released, and the hold counting from creation — the prototype reads
 * `l.touch || l.at` and no seed sets `touch` (H:3869).
 */
function planFields(seq: number, createdAt: string) {
  return {
    customInterests: [],
    touchedAt: createdAt,
    releasedAt: null,
    unreadCount: UNREAD[seq] ?? 0,
  } satisfies Partial<LeadRecord>;
}

/** The 17 leads of the Leads room, then the chat-only contact threads. */
export function leadSeed(today: string = clinicToday()): LeadRecord[] {
  const messages = leadMessageSeed(today);
  const leads = LEAD_ROWS.map((row): LeadRecord => {
    const createdAt = seedAt(row.at, '10:00', today);
    return {
      ...seedCommon(
        createdAt,
        staffRef(row.owner),
        lastTouch(row.seq, createdAt, messages),
      ),
      id: ref.lead(row.seq),
      seq: row.seq,
      name: row.name,
      phone: seedMobile(row.phone),
      email: EMAILS[row.seq] ?? null,
      status: must(STATUSES[row.status], `lead status ${row.status}`),
      source: must(SOURCES[row.source], `lead source ${row.source}`),
      interests: row.interests.map((label) =>
        must(INTERESTS[label], `interest ${label}`),
      ),
      ownerId: staffRef(row.owner),
      involvedIds: (INVOLVED[row.seq] ?? []).map(staffRef),
      followUpAt: row.followUp ? seedAt(row.followUp, '11:00', today) : null,
      branchId: branchRef(MAIN_BRANCH),
      patientId: row.patient ? patientRef(row.patient) : null,
      isContactThread: false,
      kind: row.retarget ? 'retarget' : 'enquiry',
      retargetReason: row.retarget ?? null,
      notes: null,
      ...planFields(row.seq, createdAt),
    };
  });
  const threads = CONTACT_THREADS.map((row): LeadRecord => {
    const createdAt = threadOpenedAt(row, today);
    return {
      ...seedCommon(createdAt, staffRef('RS'), lastTouch(row.seq, createdAt, messages)),
      id: ref.lead(row.seq),
      seq: row.seq,
      name: row.name,
      phone: seedMobile(row.phone),
      email: null,
      status: null,
      source: null,
      interests: [],
      ownerId: null,
      involvedIds: [],
      followUpAt: null,
      branchId: branchRef(MAIN_BRANCH),
      patientId: row.patient ? patientRef(row.patient) : null,
      isContactThread: true,
      kind: 'contact_thread',
      retargetReason: null,
      notes: null,
      ...planFields(row.seq, createdAt),
    };
  });
  return [...leads, ...threads];
}
