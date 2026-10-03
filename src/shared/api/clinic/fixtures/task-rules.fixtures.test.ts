import { describe, expect, it } from 'vitest';

import { fixtureUuid } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type {
  Appointment,
  CheckIn,
  LeadMessage,
  Patient,
  PatientPackage,
  Treatment,
} from '@/shared/api/clinic/clinic-schema.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { TaskRecord } from '@/shared/api/clinic/tasks-contracts.ts';

import { appointmentSeed } from './appointments.fixtures.ts';
import { leadMessageSeed, leadSeed } from './leads.fixtures.ts';
import {
  checkInSeed,
  patientPackageSeed,
  treatmentSeed,
} from './patient-records.fixtures.ts';
import { patientSeed } from './patients.fixtures.ts';
import { staffRef, staffSeed } from './staff.fixtures.ts';
import {
  clockLabel,
  dayLabel,
  deriveRuleTasks,
  fullDateLabel,
  planTaskRuleSync,
  selfCloseResult,
  staffShortName,
  taskRuleKeys,
  type TaskRuleMatch,
  type TaskRuleWorld,
} from './task-rules.fixtures.ts';
import { taskSeed } from './tasks.fixtures.ts';

/**
 * The rule job on its own (Q-T3): small worlds built from the seed records'
 * shapes, the job called with an explicit clock — no collections, no API.
 */
const TODAY = '2026-10-03';
// 10:00 in the clinic (IST).
const NOW = new Date('2026-10-03T04:30:00Z');
const at = (date: string, time: string) => clinicInstant(date, time);
const VIEWER = staffRef('RS');
const NIDHI = staffRef('NK');
const ASHA = staffRef('AS');
const DOCTOR = staffRef('DR');

const first = <T>(rows: readonly T[], what: string): T => {
  const row = rows[0];
  if (!row) throw new Error(`no ${what} in the seed`);
  return row;
};
const STAFF = staffSeed(TODAY);
const LEAD = first(leadSeed(TODAY), 'lead');
const MESSAGE = first(leadMessageSeed(TODAY), 'message');
const VISIT = first(appointmentSeed(TODAY), 'appointment');
const TREATMENT = first(treatmentSeed(TODAY), 'treatment');
const CHECK_IN = first(checkInSeed(TODAY), 'check-in');
const PACKAGE = first(patientPackageSeed(TODAY), 'package');
const PATIENT: Patient = {
  ...first(
    patientSeed(TODAY).filter((row) => row.firstName === 'Meera'),
    'patient',
  ),
  followUpAt: null,
};

let counter = 0;
const id = (kind: string) => {
  counter += 1;
  return fixtureUuid(`job-test-${kind}`, counter);
};

const lead = (patch: Partial<LeadRecord> = {}): LeadRecord => ({
  ...structuredClone(LEAD),
  id: id('lead'),
  name: 'Kabir Mehta',
  status: 'contacted',
  ownerId: NIDHI,
  patientId: null,
  isContactThread: false,
  kind: 'enquiry',
  interests: ['prp'],
  followUpAt: null,
  updatedAt: at(TODAY, '09:00'),
  // The hold's clock: the owner's last activity (Q-L9).
  touchedAt: at(TODAY, '09:00'),
  releasedAt: null,
  ...patch,
});
const message = (leadId: string, patch: Partial<LeadMessage> = {}): LeadMessage => ({
  ...structuredClone(MESSAGE),
  id: id('message'),
  leadId,
  channel: 'whatsapp',
  direction: 'received',
  body: 'Do you do PRP?',
  deliveryStatus: 'delivered',
  isSystem: false,
  sentAt: at(TODAY, '09:40'),
  ...patch,
});
const visit = (patch: Partial<Appointment> = {}): Appointment => ({
  ...structuredClone(VISIT),
  id: id('visit'),
  patientId: PATIENT.id,
  leadId: null,
  doctorId: DOCTOR,
  serviceLabel: 'Peel',
  date: TODAY,
  startTime: '11:30',
  status: 'scheduled',
  ...patch,
});
const treatment = (patch: Partial<Treatment> = {}): Treatment => ({
  ...structuredClone(TREATMENT),
  id: id('treatment'),
  patientId: PATIENT.id,
  name: 'Chemical peel · session 1',
  performedAt: at(TODAY, '09:00'),
  aftercareCall: 'next_day',
  ...patch,
});

function world(parts: Partial<TaskRuleWorld> = {}): TaskRuleWorld {
  return {
    now: NOW,
    viewerId: VIEWER,
    holdDays: 3,
    staff: STAFF,
    patients: [PATIENT],
    leads: [],
    messages: [],
    appointments: [],
    treatments: [],
    checkIns: [],
    packages: [],
    ...parts,
  };
}

const only = (matches: TaskRuleMatch[]) => {
  expect(matches).toHaveLength(1);
  return matches[0] as TaskRuleMatch;
};

describe('lead rules', () => {
  it('Unreplied messages: their last real message is inbound — reply within 30 min', () => {
    const kabir = lead();
    const wrote = message(kabir.id, { channel: 'instagram', sentAt: at(TODAY, '09:42') });
    const found = only(deriveRuleTasks(world({ leads: [kabir], messages: [wrote] })));
    expect(found).toMatchObject({
      rule: 'reply',
      kind: 'follow_up',
      ruleKey: taskRuleKeys.reply(kabir.id, wrote.id),
      title: 'Reply to Kabir',
      why: 'Wrote on Instagram · waiting 18 min',
      dueAt: at(TODAY, '10:12'),
      ownerId: NIDHI,
      leadId: kabir.id,
      sourceType: 'lead',
      sourceId: kabir.id,
    });
  });

  it('Unreplied messages: not after a reply, a note or a call, nor for a closed lead', () => {
    const answered = lead();
    const noted = lead();
    const closed = lead({ status: 'not_interested' });
    const messages = [
      message(answered.id),
      message(answered.id, { direction: 'sent', sentAt: at(TODAY, '09:50') }),
      message(noted.id),
      message(noted.id, {
        channel: 'note',
        direction: 'sent',
        sentAt: at(TODAY, '09:50'),
      }),
      message(closed.id),
      // A system line after the inbound message does not answer it.
      message(answered.id, {
        isSystem: true,
        channel: 'note',
        sentAt: at(TODAY, '09:55'),
      }),
    ];
    expect(
      deriveRuleTasks(world({ leads: [answered, noted, closed], messages })).map(
        (found) => found.rule,
      ),
    ).toEqual([]);
  });

  it('Messages not delivered: the last failed message with nothing sent after it', () => {
    const kabir = lead();
    const failed = message(kabir.id, {
      direction: 'sent',
      channel: 'instagram',
      deliveryStatus: 'failed',
      sentAt: at(TODAY, '10:04'),
      body: 'A counsellor will call you by 11:00.',
    });
    const found = only(deriveRuleTasks(world({ leads: [kabir], messages: [failed] })));
    expect(found).toMatchObject({
      rule: 'failed',
      title: 'Message to Kabir not delivered',
      why: 'Instagram could not deliver at 10:04 am',
      dueAt: '2026-10-03T04:05:00.000Z',
      ownerId: NIDHI,
    });
    const resent = message(kabir.id, {
      direction: 'sent',
      deliveryStatus: 'sent',
      sentAt: at(TODAY, '10:06'),
    });
    expect(
      deriveRuleTasks(world({ leads: [kabir], messages: [failed, resent] })),
    ).toEqual([]);
  });

  it('Lead follow-ups: the follow-up date has come for an open follow-up', () => {
    const due = lead({
      status: 'follow_up',
      followUpAt: at('2026-10-02', '11:00'),
      interests: ['lhr', 'peel'],
    });
    const later = lead({ status: 'follow_up', followUpAt: at('2026-10-04', '11:00') });
    const fresh = lead({ status: 'new', followUpAt: at('2026-10-02', '11:00') });
    const found = only(deriveRuleTasks(world({ leads: [due, later, fresh] })));
    expect(found).toMatchObject({
      rule: 'follow',
      ruleKey: taskRuleKeys.follow(due.id, '2026-10-02'),
      title: 'Follow up with Kabir',
      why: 'Follow-up · follow-up was due yesterday · interested in LHR, Peel',
      dueAt: at('2026-10-02', '11:00'),
      ownerId: NIDHI,
    });
  });

  it('Leads open to claim: the owner left, or sat on it past the hold — never mine or a patient’s', () => {
    const left = lead({ name: 'Poonam Balar', ownerId: ASHA });
    const idle = lead({ name: 'Najmus', touchedAt: at('2026-09-29', '10:00') });
    const mine = lead({ ownerId: VIEWER, touchedAt: at('2026-09-20', '10:00') });
    const patient = lead({ patientId: PATIENT.id, touchedAt: at('2026-09-20', '10:00') });
    const recent = lead({ touchedAt: at('2026-10-01', '10:00') });
    const matches = deriveRuleTasks(
      world({ leads: [left, idle, mine, patient, recent], now: NOW }),
    );
    expect(matches.map((found) => [found.title, found.why, found.ownerId])).toEqual([
      ['Claim or leave Poonam', 'Asha M. has left the clinic · open to the team', null],
      [
        'Claim or leave Najmus',
        'Nidhi K. has been idle 4 days · anyone can take it',
        null,
      ],
    ]);
    expect(matches[0]?.dueAt).toBe('2026-10-03T07:30:00.000Z');
  });

  it('reads no contact thread — they are not leads (S:261)', () => {
    const thread = lead({ isContactThread: true, kind: 'contact_thread', status: null });
    expect(
      deriveRuleTasks(world({ leads: [thread], messages: [message(thread.id)] })),
    ).toEqual([]);
  });
});

describe('appointment rules', () => {
  it('Confirm visits: a Scheduled visit within 48 h — due 2 h before, or 18:00 the day before', () => {
    const soon = visit({ startTime: '15:30' });
    const tomorrow = visit({ date: '2026-10-04', startTime: '15:30' });
    const far = visit({ date: '2026-10-06' });
    const confirmed = visit({ startTime: '16:00', status: 'confirmed' });
    const matches = deriveRuleTasks(
      world({ appointments: [soon, tomorrow, far, confirmed] }),
    );
    expect(
      matches.map((found) => [found.rule, found.title, found.why, found.dueAt]),
    ).toEqual([
      [
        'confirm',
        'Confirm Meera’s visit',
        'Today 3:30 pm · Peel with Dr. Reenal · no reply to the reminder',
        at(TODAY, '13:30'),
      ],
      [
        'confirm',
        'Confirm Meera’s visit',
        'Tomorrow 3:30 pm · Peel with Dr. Reenal · no reply to the reminder',
        at(TODAY, '18:00'),
      ],
    ]);
    expect(matches[0]).toMatchObject({
      ownerId: VIEWER,
      patientId: PATIENT.id,
      sourceType: 'appointment',
      sourceId: soon.id,
      ruleKey: taskRuleKeys.confirm(soon),
    });
  });

  it('Arrived or no-show: today, more than 15 minutes past the start', () => {
    const late = visit({ startTime: '09:40' });
    const justStarted = visit({ startTime: '09:50' });
    const found = only(deriveRuleTasks(world({ appointments: [late, justStarted] })));
    expect(found).toMatchObject({
      rule: 'arrive',
      title: 'Has Meera arrived?',
      why: 'Today 9:40 am · Peel with Dr. Reenal · not checked in yet',
      dueAt: at(TODAY, '09:55'),
    });
  });

  it('Rebook no-shows: a No show, due the next day at 11:00', () => {
    const missed = visit({ date: '2026-10-01', status: 'no_show' });
    expect(only(deriveRuleTasks(world({ appointments: [missed] })))).toMatchObject({
      rule: 'rebook',
      title: 'Rebook Meera',
      why: 'Missed Peel on Thu 1 Oct 11:30 am',
      dueAt: at('2026-10-02', '11:00'),
    });
  });

  it('Collect feedback: Completed in the last 3 days, not today — due today 12:00', () => {
    const yesterday = visit({ date: '2026-10-02', status: 'completed' });
    const today = visit({ startTime: '09:00', status: 'completed' });
    const old = visit({ date: '2026-09-29', status: 'completed' });
    // A follow-up date keeps Meera out of Next visit not set.
    const followedUp = { ...PATIENT, followUpAt: at('2026-10-20', '11:00') };
    const found = only(
      deriveRuleTasks(
        world({ appointments: [yesterday, today, old], patients: [followedUp] }),
      ),
    );
    expect(found).toMatchObject({
      rule: 'feedback',
      title: 'Ask Meera how it went',
      why: 'Peel with Dr. Reenal on Yesterday · ask for a rating and book the next session',
      dueAt: at(TODAY, '12:00'),
    });
  });

  it('names a contact-only visitor by their thread', () => {
    const thread = lead({
      name: 'Vikram Bhatt',
      isContactThread: true,
      kind: 'contact_thread',
    });
    const missed = visit({ patientId: null, leadId: thread.id, status: 'no_show' });
    const found = only(
      deriveRuleTasks(world({ appointments: [missed], leads: [thread] })),
    );
    expect(found).toMatchObject({
      title: 'Rebook Vikram',
      leadId: thread.id,
      patientId: null,
    });
  });
});

describe('treatment and patient rules', () => {
  it('Aftercare calls: N days after the treatment, from two days before the call day', () => {
    const nextDay = treatment();
    const dayTwo = treatment({
      aftercareCall: 'in_2_days',
      performedAt: at('2026-10-02', '09:00'),
    });
    const week = treatment({ aftercareCall: 'in_week' });
    const none = treatment({ aftercareCall: 'none' });
    const matches = deriveRuleTasks(world({ treatments: [nextDay, dayTwo, week, none] }));
    expect(matches.map((found) => [found.title, found.why, found.dueAt])).toEqual([
      [
        'Next-day call · Meera',
        'Chemical peel · session 1 on today · ask how the skin feels and what they followed',
        at('2026-10-04', '11:00'),
      ],
      [
        'Day-2 call · Meera',
        'Chemical peel · session 1 on yesterday · ask how the skin feels and what they followed',
        at('2026-10-04', '11:00'),
      ],
    ]);
    // Done today, a day-2 call is due on the 5th at 11:00 — more than two days off.
    expect(
      deriveRuleTasks(world({ treatments: [treatment({ aftercareCall: 'in_2_days' })] })),
    ).toEqual([]);
    expect(matches[0]).toMatchObject({
      rule: 'aftercare',
      sourceType: 'treatment',
      sourceId: nextDay.id,
      ownerId: VIEWER,
    });
  });

  it('Aftercare calls: none once a check-in answers it, or 30 days on', () => {
    const answered = treatment();
    const old = treatment({ performedAt: at('2026-08-20', '10:00') });
    const checkIn: CheckIn = { ...structuredClone(CHECK_IN), treatmentId: answered.id };
    expect(
      deriveRuleTasks(world({ treatments: [answered, old], checkIns: [checkIn] })),
    ).toEqual([]);
  });

  it('Next visit not set: a visit 1–45 days ago, nothing booked, no follow-up date', () => {
    const last = visit({
      date: '2026-09-23',
      status: 'completed',
      serviceLabel: 'Hydrafacial',
    });
    const found = only(deriveRuleTasks(world({ appointments: [last] })));
    expect(found).toMatchObject({
      rule: 'nextvisit',
      ruleKey: taskRuleKeys.nextvisit(PATIENT.id, '2026-09-23'),
      title: 'Set Meera’s next visit',
      why: 'Hydrafacial on wed 23 sep · no follow-up date and nothing booked',
      dueAt: at(TODAY, '17:00'),
      sourceType: null,
      patientId: PATIENT.id,
    });
    const booked = visit({ date: '2026-10-09' });
    expect(deriveRuleTasks(world({ appointments: [last, booked] }))).toEqual([]);
    const followedUp = { ...PATIENT, followUpAt: at('2026-10-20', '11:00') };
    expect(
      deriveRuleTasks(world({ appointments: [last], patients: [followedUp] })),
    ).toEqual([]);
  });

  it('Regulars gone quiet: two visits or sessions left, the last 30+ days ago', () => {
    const visits = [
      visit({ date: '2026-08-24', status: 'completed' }),
      visit({ date: '2026-07-10', status: 'completed' }),
    ];
    const followedUp = { ...PATIENT, followUpAt: at('2026-10-20', '11:00') };
    expect(
      only(deriveRuleTasks(world({ appointments: visits, patients: [followedUp] }))),
    ).toMatchObject({
      rule: 'noreply',
      title: 'Meera has gone quiet',
      why: 'Regular patient · last visit 40 days ago · 2 reminders sent, no reply',
      dueAt: at(TODAY, '12:00'),
    });
    const sessionsLeft: PatientPackage = {
      ...structuredClone(PACKAGE),
      patientId: PATIENT.id,
      sessionsUsed: 1,
      sessionsTotal: 6,
    };
    const one = [visit({ date: '2026-09-02', status: 'completed' })];
    expect(
      only(
        deriveRuleTasks(
          world({ appointments: one, patients: [followedUp], packages: [sessionsLeft] }),
        ),
      ).why,
    ).toBe(
      'Package has sessions left · last visit 31 days ago · 1 reminder sent, no reply',
    );
    const recent = [visit({ date: '2026-09-05', status: 'completed' })];
    expect(
      deriveRuleTasks(
        world({ appointments: recent, patients: [followedUp], packages: [sessionsLeft] }),
      ),
    ).toEqual([]);
  });
});

describe('planTaskRuleSync — how stored tasks catch up', () => {
  const seeded = taskSeed(TODAY);
  const confirmTask = seeded.find((task) => task.rule === 'confirm') as TaskRecord;
  const kept: TaskRuleMatch = {
    ruleKey: confirmTask.ruleKey ?? '',
    rule: 'confirm',
    kind: 'confirm_visit',
    title: confirmTask.title,
    why: '',
    dueAt: confirmTask.dueAt,
    ownerId: VIEWER,
    patientId: confirmTask.patientId,
    leadId: null,
    sourceType: 'appointment',
    sourceId: confirmTask.sourceId,
  };
  const fresh: TaskRuleMatch = { ...kept, ruleKey: 'reply:new', rule: 'reply' };

  it('creates what no task carries yet and never re-creates a task, even a closed one', () => {
    const closed = { ...confirmTask, status: 'done' as const };
    expect(planTaskRuleSync([confirmTask], [kept, fresh], NOW).create).toEqual([fresh]);
    expect(planTaskRuleSync([closed], [kept], NOW).create).toEqual([]);
  });

  it('closes a derived task whose condition is gone, with its rule’s result', () => {
    const reply = {
      ...confirmTask,
      id: id('task'),
      rule: 'reply' as const,
      ruleKey: 'reply:gone',
    };
    const snoozed = {
      ...confirmTask,
      id: id('task'),
      rule: 'rebook' as const,
      ruleKey: 'rebook:gone',
      status: 'snoozed' as const,
      snoozedUntil: at('2026-10-04', '10:00'),
    };
    expect(planTaskRuleSync([confirmTask, reply, snoozed], [], NOW).close).toEqual([
      { id: confirmTask.id, result: 'Visit status changed in Appointments' },
      { id: reply.id, result: 'Reply sent from the lead chat' },
      { id: snoozed.id, result: 'Resolved in Appointments' },
    ]);
  });

  it('leaves closed tasks, keyless tasks and event-made rules alone', () => {
    const done = { ...confirmTask, status: 'done' as const };
    const keyless = seeded.filter((task) => task.ruleKey === null);
    const unhappy = {
      ...confirmTask,
      id: id('task'),
      rule: 'unhappy' as const,
      ruleKey: 'x',
    };
    expect(planTaskRuleSync([done, ...keyless, unhappy], [], NOW).close).toEqual([]);
  });

  it('wakes a snoozed task once its time has come', () => {
    const due = {
      ...confirmTask,
      status: 'snoozed' as const,
      snoozedUntil: at(TODAY, '09:59'),
    };
    const later = { ...due, id: id('task'), snoozedUntil: at(TODAY, '10:01') };
    expect(planTaskRuleSync([due, later], [kept], NOW).wake).toEqual([due.id]);
  });
});

describe('the seeds and the job agree', () => {
  it('derives the seeded confirm, rebook and feedback tasks under the seeds’ own keys', () => {
    const seeds = taskSeed(TODAY);
    const keyed = seeds.flatMap((task) => (task.ruleKey ? [task.ruleKey] : []));
    expect(keyed).toHaveLength(3);
    const matches = deriveRuleTasks({
      ...world(),
      patients: patientSeed(TODAY),
      leads: leadSeed(TODAY),
      messages: leadMessageSeed(TODAY),
      appointments: appointmentSeed(TODAY),
      treatments: treatmentSeed(TODAY),
      checkIns: checkInSeed(TODAY),
      packages: patientPackageSeed(TODAY),
    });
    const plan = planTaskRuleSync(seeds, matches, NOW);
    expect(plan.close).toEqual([]);
    expect(plan.create.map((found) => found.ruleKey)).not.toEqual(
      expect.arrayContaining(keyed),
    );
    expect(new Set(matches.map((found) => found.ruleKey)).size).toBe(matches.length);
  });
});

describe('server text', () => {
  it('labels days, clock times, follow-up dates and staff the prototype’s way', () => {
    expect(dayLabel(TODAY, TODAY)).toBe('Today');
    expect(dayLabel('2026-10-04', TODAY)).toBe('Tomorrow');
    expect(dayLabel('2026-10-02', TODAY)).toBe('Yesterday');
    expect(dayLabel('2026-10-08', TODAY)).toBe('Thu 8 Oct');
    expect(clockLabel('00:05')).toBe('12:05 am');
    expect(clockLabel('12:00')).toBe('12:00 pm');
    expect(clockLabel('15:30')).toBe('3:30 pm');
    expect(fullDateLabel('2026-10-17')).toBe('17 Oct 2026');
    expect(staffShortName({ firstName: 'Riya', lastName: 'Shah' })).toBe('Riya S.');
    expect(staffShortName({ firstName: 'Dr. Reenal', lastName: 'Chaniyara' })).toBe(
      'Dr. Reenal',
    );
    expect(staffShortName({ firstName: 'Asha', lastName: null })).toBe('Asha');
  });

  it('closes a rule’s task in its group’s name', () => {
    expect(selfCloseResult('claim')).toBe('Resolved in Leads');
    expect(selfCloseResult('aftercare')).toBe('Resolved in Treatments');
    expect(selfCloseResult('nextvisit')).toBe('Resolved in Patients');
    expect(selfCloseResult('feedback')).toBe('Resolved in Feedback');
  });
});
