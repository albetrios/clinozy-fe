import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  fetchContactHistory,
  fetchMessagingStatus,
  fetchTemplateValues,
  fetchThread,
  fixtureContactStream,
  resendMessage,
  sendMessage,
} from './chat.fixtures.ts';
import { ensureContactThreadInWorld as ensureContactThread } from './contact-threads.fixtures.ts';
import { setFixtureWhatsAppOutage } from './messages.fixtures.ts';
import { patientRef } from './patients.fixtures.ts';
import { ref } from './refs.fixtures.ts';
import { FIXTURE_VIEWER_ID, staffRef } from './staff.fixtures.ts';
import { appFixtures, resetAppFixtures } from './world.fixtures.ts';

const ANAYA = ref.lead(2363); // New, two WhatsApp messages in, unread — the viewer's own
const KABIR = ref.lead(2364); // Contacted, a failed Instagram reply; the viewer is involved
const ONLINE_CON = ref.lead(2361); // New, no messages; Dr. Drashti's
const ALPA = ref.lead(2360); // Follow-up, replies by her owner
const DHARTI = patientRef('Dharti Galani'); // a patient with a lead and history
const KIRAN = patientRef('Kiran Desai'); // a patient with no thread

/** The rejection a call ends in, so its status and code can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (error.data as { error: { code: string; detail: string } }).error;
  return { status: error.status, ...body };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 15:00 in the clinic (IST) — after every seeded message of the day.
  vi.setSystemTime(new Date('2026-10-03T09:30:00Z'));
  resetAppFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  // The world's reset also brings WhatsApp back.
  resetAppFixtures();
});

describe('the thread (getLead, S:1589)', () => {
  it('reads a lead’s thread with its messages oldest first', async () => {
    const read = await fetchThread({ kind: 'lead', leadId: ANAYA });
    expect(read.thread).toEqual({
      leadId: ANAYA,
      kind: 'enquiry',
      createdAt: '2026-10-03T04:58:00.000Z',
      source: 'whatsapp',
      patientId: null,
    });
    expect(read.messages.map((message) => message.body)).toEqual([
      'Lead created from WhatsApp ad',
      'Hi, I have acne scars since 2 years. What is the treatment and price?',
      'Is Saturday possible?',
    ]);
    expect(read.authors).toEqual({});
  });

  it('names the team members a thread’s messages were written by', async () => {
    const read = await fetchThread({ kind: 'lead', leadId: ALPA });
    const owner = staffRef('DR');
    expect(read.authors[owner]).toMatchObject({ id: owner, roles: ['doctor'] });
    expect(read.messages.filter((message) => message.authorId === owner)).toHaveLength(2);
  });

  it('finds a patient’s thread through their lead (findPersonThread), and none when they have no thread', async () => {
    const dharti = await fetchThread({ kind: 'patient', patientId: DHARTI });
    expect(dharti.thread?.leadId).toBe(ref.lead(2352));
    expect(dharti.thread?.patientId).toBe(DHARTI);

    expect(await fetchThread({ kind: 'patient', patientId: KIRAN })).toEqual({
      thread: null,
      messages: [],
      authors: {},
    });
  });

  it('answers an unknown lead with a 404', async () => {
    const failure = await failureOf(
      fetchThread({ kind: 'lead', leadId: ref.lead(9999) }),
    );
    expect(failure.status).toBe(404);
  });
});

describe('the contact history (Appendix F merged feed)', () => {
  it('merges a patient’s records oldest first, joined by id', async () => {
    const history = await fetchContactHistory({ kind: 'patient', patientId: DHARTI });
    expect(history.map((entry) => entry.kind)).toEqual([
      'appointment',
      'appointment',
      'treatment',
      'prescription',
      'invoice',
      'invoice',
      'checkIn',
      'invoice',
      'payment',
      'checkIn',
      'review',
      'appointment',
    ]);
    const sorted = [...history].sort((a, b) => a.sortAt.localeCompare(b.sortAt));
    expect(history).toEqual(sorted);
  });

  it('carries each line’s facts: bills and dues, the paid invoice, the score and rating', async () => {
    const history = await fetchContactHistory({ kind: 'lead', leadId: ref.lead(2352) });
    const invoice = history.find(
      (entry) => entry.kind === 'invoice' && entry.seq === 787,
    );
    expect(invoice).toMatchObject({ type: 'clinic', bill: 480_000, due: 480_000 });
    const paid = history.find((entry) => entry.kind === 'invoice' && entry.seq === 782);
    expect(paid).toMatchObject({ bill: 900_000, due: 0 });
    expect(history.find((entry) => entry.kind === 'payment')).toMatchObject({
      refund: false,
      amount: 900_000,
      modes: ['upi'],
      invoiceSeq: 782,
    });
    expect(history.find((entry) => entry.kind === 'checkIn')).toMatchObject({
      feel: 'same',
      score: 6,
      context: 'Consultation',
    });
    expect(history.find((entry) => entry.kind === 'review')).toMatchObject({
      source: 'google',
      rating: 5,
    });
    expect(history.find((entry) => entry.kind === 'prescription')).toMatchObject({
      seq: 497,
      medicines: ['Sunscreen SPF 50'],
      when: { kind: 'day', date: '2026-09-30' },
    });
    expect(history.at(-1)).toMatchObject({
      kind: 'appointment',
      seq: 2859,
      status: 'confirmed',
      when: { kind: 'instant', at: '2026-10-14T05:30:00.000Z' },
    });
  });

  it('lists a reminder once it has gone out — a day before the visit', async () => {
    const jalpa = { kind: 'lead', leadId: ref.lead(2375) } as const; // visit 4 Oct 10:30
    const before = new Date('2026-10-03T04:00:00Z'); // 9:30 the day before
    expect((await fetchContactHistory(jalpa, before)).map((entry) => entry.kind)).toEqual(
      ['appointment'],
    );

    const history = await fetchContactHistory(jalpa);
    expect(history.map((entry) => entry.kind)).toEqual(['reminder', 'appointment']);
    expect(history[0]).toMatchObject({
      service: 'Treatment',
      when: { kind: 'instant', at: '2026-10-03T05:00:00.000Z' },
      visitAt: '2026-10-04T05:00:00.000Z',
    });
  });

  it('adds a resolved task with what closed it — the server’s result, else the outcome', async () => {
    const [callBack] = appFixtures.tasks.snapshot((task) => task.leadId === KABIR);
    expect(callBack).toBeDefined();
    await appFixtures.tasks.update(callBack?.id ?? '', {
      status: 'done',
      outcome: 'no_answer',
      resolvedAt: '2026-10-03T04:20:00.000Z',
    });
    const history = await fetchContactHistory({ kind: 'lead', leadId: KABIR });
    expect(history).toEqual([
      expect.objectContaining({
        kind: 'task',
        id: callBack?.id,
        title: callBack?.title,
        outcome: 'no_answer',
        result: null,
        when: { kind: 'instant', at: '2026-10-03T04:20:00.000Z' },
      }),
    ]);

    // A rule outcome the contract has no value for still closes the task, with its result.
    await appFixtures.tasks.update(callBack?.id ?? '', {
      outcome: null,
      result: 'Booked a visit',
    });
    expect(await fetchContactHistory({ kind: 'lead', leadId: KABIR })).toEqual([
      expect.objectContaining({ outcome: 'done', result: 'Booked a visit' }),
    ]);
  });
});

describe('template values', () => {
  it('reads the clinic, the thread’s branch with its links and the next two free slots', async () => {
    expect(await fetchTemplateValues({ kind: 'lead', leadId: ANAYA })).toEqual({
      clinicName: 'Cresence Skin',
      address:
        '3rd floor, Shree Hari Complex, Near Star Bazaar, Adajan Gam Road, Adajan, Surat',
      mapsLink: 'maps.app.goo.gl/cresence',
      reviewLink: 'g.page/r/cresence/review',
      // Today only after 15:00 — 16:00 is free; then tomorrow's first free time.
      freeSlots: [
        { date: '2026-10-03', time: '16:00' },
        { date: '2026-10-04', time: '11:00' },
      ],
    });
  });

  it('uses a patient’s home branch when they have no thread', async () => {
    const values = await fetchTemplateValues({ kind: 'patient', patientId: KIRAN });
    expect(values.address).toContain('Surat');
    expect(values.freeSlots).toHaveLength(2);
  });
});

describe('sending (sendMessage, S:1595)', () => {
  it('queues a WhatsApp reply, hands it over and moves a New lead to Contacted', async () => {
    const sent = await sendMessage({
      leadId: ANAYA,
      channel: 'whatsapp',
      body: '  Hi Anaya, Saturday 11:30 works.  ',
    });
    expect(sent).toMatchObject({
      leadId: ANAYA,
      channel: 'whatsapp',
      direction: 'sent',
      body: 'Hi Anaya, Saturday 11:30 works.',
      deliveryStatus: 'queued',
      isSystem: false,
      authorId: FIXTURE_VIEWER_ID,
    });
    expect(sent).not.toHaveProperty('seq');

    const read = await fetchThread({ kind: 'lead', leadId: ANAYA });
    expect(
      read.messages.slice(-2).map((message) => [message.body, message.deliveryStatus]),
    ).toEqual([
      ['Hi Anaya, Saturday 11:30 works.', 'sent'],
      ['Status → Contacted (first reply)', 'sent'],
    ]);
    expect(read.messages.at(-1)?.isSystem).toBe(true);
    expect((await appFixtures.leads.get(ANAYA)).status).toBe('contacted');
  });

  it('moves a New lead to Contacted when a call is logged, never for a note', async () => {
    await sendMessage({ leadId: ONLINE_CON, channel: 'note', body: 'Tried twice' });
    expect((await appFixtures.leads.get(ONLINE_CON)).status).toBe('new');

    await sendMessage({ leadId: ONLINE_CON, channel: 'call', body: 'Will visit Monday' });
    const read = await fetchThread({ kind: 'lead', leadId: ONLINE_CON });
    expect(read.messages.map((message) => message.body)).toEqual([
      'Tried twice',
      'Will visit Monday',
      'Status → Contacted (call logged)',
    ]);
    expect(read.messages[1]?.deliveryStatus).toBe('sent');
    expect((await appFixtures.leads.get(ONLINE_CON)).status).toBe('contacted');
  });

  it('writes no status line once the lead is past New', async () => {
    await sendMessage({ leadId: KABIR, channel: 'instagram', body: 'Calling at 11' });
    const read = await fetchThread({ kind: 'lead', leadId: KABIR });
    expect(read.messages.at(-1)?.body).toBe('Calling at 11');
    expect((await appFixtures.leads.get(KABIR)).status).toBe('contacted');
  });

  it('keeps WhatsApp replies queued while WhatsApp is down', async () => {
    setFixtureWhatsAppOutage(true);
    expect(await fetchMessagingStatus()).toEqual({
      whatsappDown: true,
      isConnected: true,
    });
    await sendMessage({ leadId: KABIR, channel: 'whatsapp', body: 'Are you free?' });
    await sendMessage({ leadId: KABIR, channel: 'instagram', body: 'Or here?' });
    const read = await fetchThread({ kind: 'lead', leadId: KABIR });
    expect(read.messages.slice(-2).map((message) => message.deliveryStatus)).toEqual([
      'queued',
      'sent',
    ]);

    resetAppFixtures();
    expect(await fetchMessagingStatus()).toEqual({
      whatsappDown: false,
      isConnected: true,
    });
  });

  it('names the signed-in member — the fixture’s viewer — as the sender', async () => {
    await sendMessage({ leadId: KABIR, channel: 'note', body: 'Prefers evenings' });
    const read = await fetchThread({ kind: 'lead', leadId: KABIR });
    expect(read.messages.at(-1)?.authorId).toBe(FIXTURE_VIEWER_ID);
    expect(read.authors[FIXTURE_VIEWER_ID]).toMatchObject({
      name: 'Riya Shah',
      initials: 'RS',
    });
  });

  it('counts the owner’s message as activity: the hold starts again and the thread is read (Q-L9)', async () => {
    await appFixtures.leads.update(ANAYA, {
      touchedAt: '2026-09-25T04:30:00.000Z',
      releasedAt: '2026-10-02T04:30:00.000Z',
    });
    await sendMessage({ leadId: ANAYA, channel: 'note', body: 'Asked about scars' });
    expect(await appFixtures.leads.get(ANAYA)).toMatchObject({
      touchedAt: '2026-10-03T09:30:00.000Z',
      releasedAt: null,
      unreadCount: 0,
      involvedIds: [staffRef('NK')],
    });
  });

  it('adds anyone else who replies, calls or notes to the involved people, once (Q-L9, H:1791)', async () => {
    const before = await appFixtures.leads.get(ONLINE_CON);
    await sendMessage({ leadId: ONLINE_CON, channel: 'whatsapp', body: 'Hi there' });
    await sendMessage({ leadId: ONLINE_CON, channel: 'note', body: 'Wants evenings' });
    expect(await appFixtures.leads.get(ONLINE_CON)).toMatchObject({
      ownerId: staffRef('DD'),
      involvedIds: [FIXTURE_VIEWER_ID],
      // Someone else's message is no owner activity.
      touchedAt: before.touchedAt,
    });

    await sendMessage({ leadId: KABIR, channel: 'call', body: 'No answer' });
    expect((await appFixtures.leads.get(KABIR)).involvedIds).toEqual([FIXTURE_VIEWER_ID]);
  });

  it('moves no status or team on a contact thread', async () => {
    const thread = (await ensureContactThread({ name: 'Kiran Desai', patientId: KIRAN }))
      .lead;
    await appFixtures.leads.update(thread.id, { ownerId: staffRef('NK') });
    await sendMessage({ leadId: thread.id, channel: 'whatsapp', body: 'Hello Kiran' });
    expect(await appFixtures.leads.get(thread.id)).toMatchObject({
      status: null,
      involvedIds: [],
    });
    const read = await fetchThread({ kind: 'patient', patientId: KIRAN });
    expect(read.messages.map((message) => message.body)).toEqual(['Hello Kiran']);
  });

  it('refuses an empty or over-long message (422) and a gone thread (404)', async () => {
    const empty = await failureOf(
      sendMessage({ leadId: ANAYA, channel: 'whatsapp', body: '   ' }),
    );
    expect(empty).toMatchObject({ status: 422, code: 'validation' });
    const long = await failureOf(
      sendMessage({ leadId: ANAYA, channel: 'whatsapp', body: 'x'.repeat(1001) }),
    );
    expect(long).toMatchObject({ status: 422, code: 'validation' });
    const gone = await failureOf(
      sendMessage({ leadId: ref.lead(9999), channel: 'note', body: 'Hello' }),
    );
    expect(gone.status).toBe(404);
  });
});

describe('resending (Appendix F)', () => {
  it('queues a failed message again and hands it over', async () => {
    const failed = (await fetchThread({ kind: 'lead', leadId: KABIR })).messages.find(
      (message) => message.deliveryStatus === 'failed',
    );
    expect(failed).toBeDefined();
    const resent = await resendMessage(failed?.id ?? '');
    expect(resent.deliveryStatus).toBe('queued');
    expect((await appFixtures.leadMessages.get(failed?.id ?? '')).deliveryStatus).toBe(
      'sent',
    );
  });

  it('leaves a message that did not fail as it is', async () => {
    const delivered = (await fetchThread({ kind: 'lead', leadId: ALPA })).messages.find(
      (message) => message.deliveryStatus === 'read',
    );
    expect((await resendMessage(delivered?.id ?? '')).deliveryStatus).toBe('read');
  });
});

describe('one thread per person (D32)', () => {
  it('reads a patient’s thread once their first message opens it (ensureContactThread)', async () => {
    const { lead } = await ensureContactThread({ name: 'Kiran Desai', patientId: KIRAN });
    const read = await fetchThread({ kind: 'patient', patientId: KIRAN });
    expect(read.thread).toEqual({
      leadId: lead.id,
      kind: 'contact_thread',
      createdAt: lead.createdAt,
      source: null,
      patientId: KIRAN,
    });
  });

  it('binds a patient with a lead to that lead, the way ensureContactThread does', async () => {
    const { lead } = await ensureContactThread({ name: 'Dharti', patientId: DHARTI });
    expect(lead.id).toBe(ref.lead(2352));
    expect(
      (await fetchThread({ kind: 'patient', patientId: DHARTI })).thread?.leadId,
    ).toBe(lead.id);
  });
});

describe('the contact-activities calls on the world (fixtureContactStream)', () => {
  it('reads a seeded lead’s thread by its id, as a contact’s stream', async () => {
    const read = await fixtureContactStream.fetchContactThread(ANAYA);
    expect(read).toEqual(await fetchThread({ kind: 'lead', leadId: ANAYA }));
    expect(read.messages.length).toBeGreaterThan(0);
  });

  it('opens a patient’s contact thread with their first message, once', async () => {
    const sent = await fixtureContactStream.sendContactActivity({
      contactId: KIRAN,
      channel: 'note',
      body: 'Called about the peel',
    });
    const read = await fixtureContactStream.fetchContactThread(KIRAN);
    expect(read.thread?.leadId).toBe(sent.leadId);
    expect(read.messages.map((message) => message.body)).toContain(
      'Called about the peel',
    );
    await fixtureContactStream.sendContactActivity({
      contactId: KIRAN,
      channel: 'note',
      body: 'Again',
    });
    expect((await fixtureContactStream.fetchContactThread(KIRAN)).thread?.leadId).toBe(
      sent.leadId,
    );
  });

  it('resends a failed message, and reads the status and the main branch’s values', async () => {
    const failed = appFixtures.leadMessages.snapshot(
      (row) => row.leadId === KABIR && row.deliveryStatus === 'failed',
    )[0];
    expect(failed).toBeDefined();
    const queued = await fixtureContactStream.resendContactActivity({
      activityId: failed?.id ?? '',
    });
    expect(queued.deliveryStatus).toBe('queued');
    expect((await appFixtures.leadMessages.get(queued.id)).deliveryStatus).toBe('sent');
    expect(await fixtureContactStream.fetchContactMessagingStatus()).toEqual({
      whatsappDown: false,
      isConnected: true,
    });
    const main = appFixtures.branches.snapshot().find((branch) => branch.isMain);
    expect((await fixtureContactStream.fetchContactTemplateValues()).address).toContain(
      main?.city ?? '',
    );
  });
});

describe('the fixture reader’s edges', () => {
  it('reads a check-in scored 0 as unscored, and a blank context as none', async () => {
    const lead = { kind: 'lead', leadId: ref.lead(2352) } as const;
    const before = await fetchContactHistory(lead);
    const checkIn = before.find((entry) => entry.kind === 'checkIn');
    expect(checkIn).toBeDefined();
    await appFixtures.checkIns.update(checkIn?.id ?? '', { score: 0, context: '' });

    const after = await fetchContactHistory(lead);
    expect(after.find((entry) => entry.id === checkIn?.id)).toMatchObject({
      kind: 'checkIn',
      score: null,
      context: null,
    });
  });

  it('sorts a record entered on another day at 09:00 of its own day', async () => {
    const lead = { kind: 'lead', leadId: ref.lead(2352) } as const;
    const rx = (await fetchContactHistory(lead)).find(
      (entry) => entry.kind === 'prescription',
    );
    expect(rx).toBeDefined();
    // Dated back to a day before it was written up.
    await appFixtures.prescriptions.update(rx?.id ?? '', { date: '2026-09-20' });

    const moved = (await fetchContactHistory(lead)).find((entry) => entry.id === rx?.id);
    expect(moved).toMatchObject({ when: { kind: 'day', date: '2026-09-20' } });
    expect(moved?.sortAt).toBe('2026-09-20T03:30:00.000Z');
  });

  it('fills a thread whose branch is gone from the main branch', async () => {
    await appFixtures.leads.update(ANAYA, { branchId: 'brn_gone' });
    const values = await fetchTemplateValues({ kind: 'lead', leadId: ANAYA });
    const main = appFixtures.branches.snapshot().find((branch) => branch.isMain);
    expect(values.address).toContain(main?.city ?? '');
    expect(values.clinicName).toBe('Cresence Skin');
  });

  it('offers no slot today once the day’s last candidate time has passed', async () => {
    // 22:30 in the clinic: every time today is gone.
    vi.setSystemTime(new Date('2026-10-03T17:00:00Z'));
    const { freeSlots } = await fetchTemplateValues({ kind: 'lead', leadId: ANAYA });
    expect(freeSlots.map((slot) => slot.date)).not.toContain('2026-10-03');
    expect(freeSlots).toHaveLength(2);
  });

  it('keeps the involved people as they are when one of them replies again', async () => {
    const before = await appFixtures.leads.get(KABIR);
    await sendMessage({ leadId: KABIR, channel: 'note', body: 'Called twice' });
    const after = await appFixtures.leads.get(KABIR);
    expect(after.involvedIds).toEqual(before.involvedIds);
    expect(after.involvedIds.filter((id) => id === FIXTURE_VIEWER_ID)).toHaveLength(1);
  });
});
