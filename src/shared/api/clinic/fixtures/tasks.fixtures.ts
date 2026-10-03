import { seedCommon } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type { Task, TaskKind, TaskSource } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import { contactThreadRef } from './leads.fixtures.ts';
import { patientRef } from './patients.fixtures.ts';
import { ref, seedAt } from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

interface TaskRow {
  key: string;
  kind: TaskKind;
  title: string;
  why: string;
  owner: StaffKey;
  patient?: string;
  /** A person with only a contact thread. */
  contact?: string;
  lead?: number;
  source?: { type: TaskSource; id: string };
  due: string;
  created: string;
}

/**
 * Today's work queue (`TASKS` H:3460–3469), every task open. The prototype's
 * kinds map onto the contract's seven: Confirm → confirm_visit, Payment due →
 * payment_reminder, the two after-care checks → aftercare_call, and No-show,
 * Recall and the lead Call back → follow_up (their own kinds are Appendix F).
 * Titles follow the Tasks room's rule titles (H:4241–4246); "who" and "why"
 * are the seed's. Due labels resolve on the seed day ("Due 10:50", "Overdue 40
 * min" after a 09:30 no-show, "This week" → Saturday).
 */
const TASK_ROWS: readonly TaskRow[] = [
  {
    key: 'k1',
    kind: 'confirm_visit',
    title: 'Confirm Priti’s visit',
    why: 'Laser session not confirmed. Reminder read at 08:10, no reply.',
    owner: 'RS',
    patient: 'Priti Soni',
    source: { type: 'appointment', id: ref.appointment(2848) },
    due: 'Today · 10:50',
    created: 'Today · 08:10',
  },
  {
    key: 'k2',
    kind: 'follow_up',
    title: 'Rebook Vikram',
    why: 'Missed consult. First no-show this year.',
    owner: 'RS',
    contact: 'Vikram Bhatt',
    source: { type: 'appointment', id: ref.appointment(2862) },
    due: 'Today · 09:45',
    created: 'Today · 09:45',
  },
  {
    key: 'k3',
    kind: 'payment_reminder',
    title: 'Collect ₹1,200 from Rhea',
    why: 'Balance on laser pack. She is in clinic now.',
    owner: 'RS',
    patient: 'Rhea Shah',
    due: 'Today · 18:00',
    created: 'Today · 10:40',
  },
  {
    key: 'k4',
    kind: 'aftercare_call',
    title: 'Next-day call · Pooja',
    why: 'Day-1 after-care check.',
    owner: 'KP',
    patient: 'Pooja Nair',
    due: 'Today · 12:00',
    created: 'Yesterday · 18:00',
  },
  {
    key: 'k5',
    kind: 'follow_up',
    title: 'Recall Tanvi',
    why: 'Melasma review due at 12 weeks.',
    owner: 'RS',
    patient: 'Tanvi Shah',
    due: '3 Oct · 11:00',
    created: 'Today · 08:00',
  },
  {
    key: 'k7',
    kind: 'aftercare_call',
    title: 'Ask Meera how it went',
    why: 'Day-3 check after her first facial.',
    owner: 'RS',
    patient: 'Meera Joshi',
    source: { type: 'appointment', id: ref.appointment(2841) },
    due: '30 Sep · 11:00',
    created: '26 Sep · 13:00',
  },
  {
    key: 'k8',
    kind: 'payment_reminder',
    title: 'Collect ₹12,000 from Rohan',
    why: 'PRP balance, 46 days old.',
    owner: 'MJ',
    patient: 'Rohan Pillai',
    source: { type: 'invoice', id: ref.invoice(783) },
    due: '28 Sep · 11:00',
    created: 'Today · 08:00',
  },
  {
    key: 'k6',
    kind: 'follow_up',
    title: 'Call Kabir back',
    why: 'Asked for a call about hair PRP cost.',
    owner: 'NK',
    lead: 2364,
    source: { type: 'lead', id: ref.lead(2364) },
    due: 'Today · 11:00',
    created: 'Today · 10:04',
  },
];

function leadOf(row: TaskRow): string | null {
  if (row.lead !== undefined) return ref.lead(row.lead);
  return row.contact ? contactThreadRef(row.contact) : null;
}

export function taskSeed(today: string = clinicToday()): Task[] {
  return TASK_ROWS.map((row) => ({
    ...seedCommon(seedAt(row.created, '08:00', today), staffRef(row.owner)),
    id: ref.task(row.key),
    kind: row.kind,
    title: row.title,
    why: row.why,
    ownerId: staffRef(row.owner),
    ownerRole: null,
    patientId: row.patient ? patientRef(row.patient) : null,
    leadId: leadOf(row),
    sourceType: row.source?.type ?? null,
    sourceId: row.source?.id ?? null,
    dueAt: seedAt(row.due, '11:00', today),
    status: 'open',
    snoozedUntil: null,
    outcome: null,
    resolvedAt: null,
  }));
}
