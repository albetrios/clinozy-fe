import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { clinicInstant } from './clinic-time.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { FIXTURE_VIEWER_ID, staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  createTask,
  fetchTask,
  fetchTaskPage,
  fetchTaskRuleSettings,
  handTaskToClinozy,
  normalizeTaskListQuery,
  reassignTask,
  recordTaskOutcome,
  saveTaskRuleSetting,
  snoozeTask,
  taskQueryKeys,
  undoTaskChange,
} from './tasks-api.ts';
import type { TaskListQueryInput, TaskRow } from './tasks-contracts.ts';

const TODAY = '2026-10-03';
const at = (date: string, time: string) => clinicInstant(date, time);
const clock = (date: string, time: string) => vi.setSystemTime(new Date(at(date, time)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(TODAY, '10:00');
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

const rowsOf = async (query: TaskListQueryInput = {}) =>
  (await fetchTaskPage(query)).rows;
const titles = (rows: readonly TaskRow[]) => rows.map((row) => row.title);
async function taskTitled(
  title: string,
  query: TaskListQueryInput = { scope: 'everyone' },
) {
  const row = (await rowsOf(query)).find((candidate) => candidate.title === title);
  if (!row) throw new Error(`no task "${title}"`);
  return row;
}
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  );
const status = (error: unknown) => (isHttpError(error) ? error.status : null);
const lead = (seq: number) =>
  clinicFixtures.leads.snapshot((row) => row.seq === seq)[0] ?? null;
const messagesOn = (seq: number) =>
  clinicFixtures.leadMessages
    .snapshot((message) => message.leadId === ref.lead(seq))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));

describe('the list', () => {
  it('shows my To do — mine and unowned — by due time', async () => {
    const rows = await rowsOf();
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((row) => row.status === 'open')).toBe(true);
    expect(
      rows.every((row) => row.ownerId === FIXTURE_VIEWER_ID || row.ownerId === null),
    ).toBe(true);
    expect(titles(rows)).toContain('Claim or leave Poonam');
    expect(titles(rows)).not.toContain('Reply to Nirali');
    const dues = rows.map((row) => row.dueAt);
    expect(dues).toEqual([...dues].sort());
  });

  it('shows every owner’s tasks under Everyone', async () => {
    const rows = await rowsOf({ scope: 'everyone' });
    expect(titles(rows)).toEqual(
      expect.arrayContaining([
        'Reply to Nirali',
        'Next-day call · Pooja',
        'Collect ₹12,000 from Rohan',
        'Claim or leave Poonam',
      ]),
    );
    const nirali = rows.find((row) => row.title === 'Reply to Nirali');
    expect(nirali).toMatchObject({
      rule: 'reply',
      exists: true,
      ownedByViewer: false,
      person: { name: 'Nirali Mehta', firstName: 'Nirali', isPatient: true },
      source: { kind: 'lead', seq: 2370 },
      owner: { firstName: 'Nidhi', lastName: 'K.' },
    });
  });

  it('filters by rule and searches the title, the person and the why line', async () => {
    const replies = await rowsOf({ scope: 'everyone', type: ['reply'] });
    expect(replies.length).toBeGreaterThan(0);
    expect(replies.every((row) => row.rule === 'reply')).toBe(true);
    expect(titles(await rowsOf({ scope: 'everyone', q: 'KABIR' }))).toEqual(
      expect.arrayContaining(['Message to Kabir not delivered', 'Call Kabir back']),
    );
    expect(titles(await rowsOf({ scope: 'everyone', q: 'hair prp' }))).toEqual([
      'Call Kabir back',
    ]);
    expect(titles(await rowsOf({ scope: 'everyone', q: 'Pillai' }))).toEqual([
      'Collect ₹12,000 from Rohan',
    ]);
  });

  it('drops a switched-off rule from every view and brings it back', async () => {
    await saveTaskRuleSetting({ rule: 'reply', on: false });
    expect(
      (await rowsOf({ scope: 'everyone' })).some((row) => row.rule === 'reply'),
    ).toBe(false);
    await saveTaskRuleSetting({ rule: 'reply', on: true });
    expect(
      (await rowsOf({ scope: 'everyone' })).some((row) => row.rule === 'reply'),
    ).toBe(true);
  });

  it('lists today’s resolved tasks under Done, then the visits a WhatsApp Yes confirmed', async () => {
    const before = await rowsOf({ tab: 'done' });
    expect(before.map((row) => [row.title, row.exists, row.result])).toEqual([
      ['Confirmed Jalpa’s visit', false, 'Patient replied Yes to the WhatsApp reminder'],
      ['Confirmed Dharti’s visit', false, 'Patient replied Yes to the WhatsApp reminder'],
      ['Confirmed Rhea’s visit', false, 'Patient replied Yes to the WhatsApp reminder'],
      ['Confirmed Faizan’s visit', false, 'Patient replied Yes to the WhatsApp reminder'],
    ]);
    const anaya = await taskTitled('Reply to Anaya');
    await recordTaskOutcome({ taskId: anaya.id, outcome: 'notInterested' });
    const after = await rowsOf({ tab: 'done' });
    expect(after[0]).toMatchObject({ title: 'Reply to Anaya', exists: true });
    expect(after).toHaveLength(5);
  });

  it('pages 50 at a time by cursor', async () => {
    const total = (await rowsOf({ scope: 'everyone' })).length;
    for (let index = 0; index < 60; index += 1) {
      await createTask({
        title: `Follow-up ${index}`,
        ownerId: FIXTURE_VIEWER_ID,
        dueAt: at('2026-10-10', '11:00'),
      });
    }
    const first = await fetchTaskPage({ scope: 'everyone' });
    expect(first.rows).toHaveLength(50);
    expect(first).toMatchObject({ hasMore: true, next: '50' });
    const second = await fetchTaskPage({ scope: 'everyone' }, first.next ?? undefined);
    expect(second.rows).toHaveLength(total + 60 - 50);
    expect(second.hasMore).toBe(false);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(
      total + 60,
    );
  });

  it('keys equal queries alike', () => {
    expect(
      normalizeTaskListQuery({ type: ['reply', 'claim', 'reply'], q: '  x ' }),
    ).toEqual({
      tab: 'queue',
      scope: 'mine',
      type: ['claim', 'reply'],
      q: 'x',
    });
    expect(taskQueryKeys.list({ type: ['reply', 'claim'] })).toEqual(
      taskQueryKeys.list({ type: ['claim', 'reply'], scope: 'mine' }),
    );
  });
});

describe('the drawer read', () => {
  it('reads a lead task with its lead, the thread, the message to quote and the suggestion', async () => {
    const anaya = await taskTitled('Reply to Anaya');
    const detail = await fetchTask(anaya.id);
    expect(detail.source).toMatchObject({ kind: 'lead', lead: { seq: 2363 } });
    expect(detail.thread?.seq).toBe(2363);
    expect(detail.activity.map((message) => message.body)).toEqual([
      'Lead created from WhatsApp ad',
      'Hi, I have acne scars since 2 years. What is the treatment and price?',
      'Is Saturday possible?',
    ]);
    expect(detail.quote).toBe('Is Saturday possible?');
    expect(detail.suggestion).toBe(
      'Hi Anaya, thanks for writing to us. Our doctor can see you this week. Shall I book a consultation?',
    );
    expect(detail.patient).toBeNull();
  });

  it('reads a visit task with its appointment, the patient and the visit’s doctor', async () => {
    const priti = await taskTitled('Confirm Priti’s visit');
    const detail = await fetchTask(priti.id);
    expect(detail.source?.kind).toBe('appointment');
    const doctorId =
      detail.source?.kind === 'appointment' ? detail.source.appointment.doctorId : '';
    expect(detail.staff.map((user) => user.id)).toContain(doctorId);
    expect(detail.patient?.firstName).toBe('Priti');
    expect(detail.quote).toBeNull();
    expect(detail.suggestion).toBe(
      'Hi Priti, a reminder of your LHR Treatment on Today at 11:30 am. Reply Yes to confirm.',
    );
  });

  it('answers 404 for a task that does not exist', async () => {
    expect(status(await failure(fetchTask(ref.task('nope'))))).toBe(404);
  });
});

describe('outcomes', () => {
  it('closes with the result and the note, writes the lead, and leaves a line on its chat', async () => {
    const anaya = await taskTitled('Reply to Anaya');
    const { task, undoToken } = await recordTaskOutcome({
      taskId: anaya.id,
      outcome: 'notInterested',
      note: 'asked twice',
    });
    expect(task).toMatchObject({
      status: 'done',
      outcome: 'done',
      ruleOutcome: 'reply.notInterested',
      result: 'Not interested · asked twice',
      note: 'asked twice',
      resolvedBy: 'member',
      resolvedById: FIXTURE_VIEWER_ID,
    });
    expect(lead(2363)?.status).toBe('not_interested');
    expect(messagesOn(2363).find((message) => message.taskId === anaya.id)).toMatchObject(
      {
        body: 'Task closed · Not interested',
        isSystem: true,
        channel: 'note',
      },
    );

    await undoTaskChange(undoToken);
    expect(lead(2363)?.status).toBe('new');
    expect(messagesOn(2363).some((message) => message.taskId === anaya.id)).toBe(false);
    expect((await fetchTask(anaya.id)).task).toMatchObject({
      status: 'open',
      result: null,
    });
    expect(status(await failure(undoTaskChange(undoToken)))).toBe(409);
  });

  it('snoozes "No answer" for 2 hours with a call logged, then wakes it', async () => {
    const kabir = await taskTitled('Call Kabir back');
    const { task } = await recordTaskOutcome({ taskId: kabir.id, outcome: 'noAnswer' });
    expect(task).toMatchObject({
      status: 'snoozed',
      outcome: 'no_answer',
      snoozeLabel: '2 h · no answer',
      snoozedUntil: at(TODAY, '12:00'),
    });
    expect(messagesOn(2364).find((message) => message.taskId === kabir.id)).toMatchObject(
      {
        channel: 'call',
        body: 'Called · no answer',
        isSystem: false,
        authorId: FIXTURE_VIEWER_ID,
      },
    );
    expect(titles(await rowsOf({ tab: 'snoozed', scope: 'everyone' }))).toEqual([
      'Call Kabir back',
    ]);
    clock(TODAY, '12:01');
    expect(titles(await rowsOf({ scope: 'everyone' }))).toContain('Call Kabir back');
    expect((await fetchTask(kabir.id)).task).toMatchObject({
      status: 'open',
      snoozedUntil: null,
      snoozeLabel: null,
    });
  });

  it('marks a no-show, the Rebook task follows — and Undo takes both back', async () => {
    clock(TODAY, '12:00');
    const arrived = await taskTitled('Has Priti arrived?');
    const { task, undoToken } = await recordTaskOutcome({
      taskId: arrived.id,
      outcome: 'noShow',
    });
    expect(task.result).toBe('Marked no-show');
    const visit = () =>
      clinicFixtures.appointments.snapshot((row) => row.seq === 2848)[0];
    expect(visit()?.status).toBe('no_show');
    expect(titles(await rowsOf({ scope: 'everyone' }))).toContain('Rebook Priti');

    await undoTaskChange(undoToken);
    expect(visit()?.status).toBe('scheduled');
    const rows = await rowsOf({ scope: 'everyone' });
    expect(titles(rows)).not.toContain('Rebook Priti');
    expect(titles(rows)).toContain('Has Priti arrived?');
  });

  it('claims a lead: I own it, the old owner stays involved, the rule closes the task', async () => {
    const poonam = await taskTitled('Claim or leave Poonam');
    const { task, undoToken } = await recordTaskOutcome({
      taskId: poonam.id,
      outcome: 'claimIt',
    });
    expect(lead(2362)).toMatchObject({ ownerId: FIXTURE_VIEWER_ID });
    expect(lead(2362)?.involvedIds).toContain(staffRef('AS'));
    expect(task).toMatchObject({
      status: 'done',
      resolvedBy: 'clinozy',
      result: 'Resolved in Leads',
    });

    await undoTaskChange(undoToken);
    expect(lead(2362)?.ownerId).toBe(staffRef('AS'));
    expect((await fetchTask(poonam.id)).task.status).toBe('open');
  });

  it('"Fix the number" writes nothing and keeps the task open; "Retry send" resends', async () => {
    const failed = await taskTitled('Message to Kabir not delivered');
    const before = messagesOn(2364);
    const fix = await recordTaskOutcome({ taskId: failed.id, outcome: 'fixTheNumber' });
    expect(fix.task.status).toBe('open');
    expect(messagesOn(2364)).toEqual(before);

    const retry = await recordTaskOutcome({ taskId: failed.id, outcome: 'retrySend' });
    expect(retry.task.result).toBe('Resent');
    expect(
      messagesOn(2364).find((message) => message.body.startsWith('Yes. A counsellor'))
        ?.deliveryStatus,
    ).toBe('sent');
  });

  it('turns an Unhappy rating into a call-back task for the visit’s doctor', async () => {
    const dhruv = await taskTitled('Ask Dhruv how it went');
    const { task, undoToken } = await recordTaskOutcome({
      taskId: dhruv.id,
      outcome: 'unhappy',
    });
    expect(task.result).toBe('Unhappy · call-back task created for Dr. Drashti');
    const callBack = await taskTitled('Call Dhruv back · unhappy');
    expect(callBack).toMatchObject({
      rule: 'unhappy',
      kind: 'callback',
      why: 'Unhappy after LHR Treatment on Yesterday · call before end of day',
      ownerId: staffRef('DD'),
      dueAt: at(TODAY, '18:00'),
      sourceType: 'appointment',
    });
    await undoTaskChange(undoToken);
    expect(titles(await rowsOf({ scope: 'everyone' }))).not.toContain(
      'Call Dhruv back · unhappy',
    );
  });

  it('logs a "Better" check-in for "Doing well", which ends the aftercare rule', async () => {
    const varun = await taskTitled('Next-day call · Varun');
    const { task } = await recordTaskOutcome({
      taskId: varun.id,
      outcome: 'doingWell',
      note: 'No redness',
    });
    expect(task.result).toBe('Doing well · check-in logged · No redness');
    const checkIn = clinicFixtures.checkIns.snapshot(
      (row) => row.treatmentId === ref.treatment(505),
    )[0];
    expect(checkIn).toMatchObject({
      feel: 'better',
      now: 'No redness',
      byId: FIXTURE_VIEWER_ID,
      date: TODAY,
      context: 'Chemical peel · session 1',
    });
    expect(checkIn).not.toHaveProperty('seq');
    expect(
      (await rowsOf({ scope: 'everyone' })).filter((row) => row.rule === 'aftercare'),
    ).toHaveLength(1);
  });

  it('sets the follow-up two weeks out and names the date in the result', async () => {
    const meera = await taskTitled('Set Meera’s next visit');
    const { task } = await recordTaskOutcome({
      taskId: meera.id,
      outcome: 'setFollowUpDate',
    });
    expect(task.result).toBe('Follow-up set · 17 Oct 2026');
    expect(
      clinicFixtures.patients.snapshot((row) => row.id === meera.patientId)[0]
        ?.followUpAt,
    ).toBe(at('2026-10-17', '11:00'));
  });

  it('cancels a visit for the patient', async () => {
    const ridhi = await taskTitled('Confirm Ridhi’s visit');
    await recordTaskOutcome({ taskId: ridhi.id, outcome: 'cancelledByPatient' });
    expect(
      clinicFixtures.appointments.snapshot((row) => row.seq === 2857)[0],
    ).toMatchObject({
      status: 'cancelled',
      cancelReason: 'patient_asked',
    });
  });

  it('answers 409 on a closed task and 422 on an outcome the rule lacks', async () => {
    const anaya = await taskTitled('Reply to Anaya');
    expect(
      status(await failure(recordTaskOutcome({ taskId: anaya.id, outcome: 'claimIt' }))),
    ).toBe(422);
    await recordTaskOutcome({ taskId: anaya.id, outcome: 'bookedVisit' });
    expect(lead(2363)?.status).toBe('follow_up');
    expect(
      status(
        await failure(recordTaskOutcome({ taskId: anaya.id, outcome: 'notInterested' })),
      ),
    ).toBe(409);
  });
});

describe('snooze, reassign, create, hand to the automation', () => {
  it('snoozes to 10:00 tomorrow in the clinic and wakes it then', async () => {
    const tanvi = await taskTitled('Recall Tanvi');
    const { task } = await snoozeTask({ taskId: tanvi.id, option: 'tomorrow' });
    expect(task).toMatchObject({
      status: 'snoozed',
      snoozedUntil: at('2026-10-04', '10:00'),
      snoozeLabel: 'Tomorrow 10:00',
    });
    expect(titles(await rowsOf())).not.toContain('Recall Tanvi');
    clock('2026-10-04', '10:00');
    expect(titles(await rowsOf())).toContain('Recall Tanvi');
  });

  it('moves a lead task and its lead, keeping the previous owner involved', async () => {
    const nirali = await taskTitled('Reply to Nirali');
    const kiran = staffRef('KP');
    const { task, undoToken } = await reassignTask({ taskId: nirali.id, ownerId: kiran });
    expect(task).toMatchObject({
      ownerId: kiran,
      previousOwnerIds: [staffRef('NK')],
      owner: { firstName: 'Kiran' },
      previousOwners: [{ firstName: 'Nidhi' }],
    });
    expect(lead(2370)?.ownerId).toBe(kiran);
    expect(lead(2370)?.involvedIds).toContain(staffRef('NK'));
    expect(messagesOn(2370).find((message) => message.taskId === nirali.id)?.body).toBe(
      'Moved from Nidhi K. to Kiran P. · Nidhi K. stays involved',
    );

    await undoTaskChange(undoToken);
    expect(lead(2370)?.ownerId).toBe(staffRef('NK'));
    expect((await fetchTask(nirali.id)).task.previousOwnerIds).toEqual([]);
    expect(
      status(await failure(reassignTask({ taskId: nirali.id, ownerId: staffRef('AS') }))),
    ).toBe(422);
  });

  it('creates a "What’s next" follow-up on the source of the task it follows', async () => {
    const priti = await taskTitled('Confirm Priti’s visit');
    const { task, undoToken } = await createTask({
      title: 'Call again · Priti',
      why: 'Planned after: Confirm Priti’s visit · Confirmed on call',
      ownerId: FIXTURE_VIEWER_ID,
      dueAt: at(TODAY, '13:00'),
      followsTaskId: priti.id,
    });
    expect(task).toMatchObject({
      rule: 'manual',
      kind: 'manual',
      status: 'open',
      ruleKey: null,
      patientId: priti.patientId,
      sourceType: 'appointment',
      sourceId: ref.appointment(2848),
      source: { kind: 'appointment', seq: 2848 },
    });
    expect(task).not.toHaveProperty('seq');
    await undoTaskChange(undoToken);
    expect(titles(await rowsOf())).not.toContain('Call again · Priti');
  });

  it('refuses a task with no title, field by field', async () => {
    const error = await failure(
      createTask({ title: '  ', ownerId: null, dueAt: at(TODAY, '13:00') }),
    );
    expect(status(error)).toBe(422);
    expect(
      isHttpError(error) && (error.data as { error: { fields: object } }).error.fields,
    ).toHaveProperty('title');
  });

  it('lets the automation do it: resolved with its text, the suggested WhatsApp sent', async () => {
    const anaya = await taskTitled('Reply to Anaya');
    const { task } = await handTaskToClinozy(anaya.id);
    expect(task).toMatchObject({
      status: 'done',
      resolvedBy: 'clinozy',
      ruleOutcome: 'reply.clinozy',
      result: 'Send the first reply with prices and free slots',
    });
    expect(messagesOn(2363).find((message) => message.taskId === anaya.id)).toMatchObject(
      {
        channel: 'whatsapp',
        direction: 'sent',
        authorId: null,
        body: 'Hi Anaya, thanks for writing to us. Our doctor can see you this week. Shall I book a consultation?',
      },
    );
    const poonam = await taskTitled('Claim or leave Poonam');
    expect(status(await failure(handTaskToClinozy(poonam.id)))).toBe(422);
  });
});

describe('rule settings', () => {
  it('starts with every rule on and none handed to the automation', async () => {
    const settings = await fetchTaskRuleSettings();
    expect(
      Object.values(settings).every((setting) => setting.on && !setting.handled),
    ).toBe(true);
  });

  it('hands over only a rule that has an automation', async () => {
    expect((await saveTaskRuleSetting({ rule: 'reply', handled: true })).reply).toEqual({
      on: true,
      handled: true,
    });
    expect(
      status(await failure(saveTaskRuleSetting({ rule: 'claim', handled: true }))),
    ).toBe(422);
  });
});
