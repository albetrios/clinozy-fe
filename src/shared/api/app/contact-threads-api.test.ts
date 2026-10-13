import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { appInstant } from './app-time.ts';
import { ensureContactThread } from './contact-threads-api.ts';
import {
  findPersonThread,
  interestsForService,
} from './fixtures/contact-threads.fixtures.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { FIXTURE_VIEWER_ID } from './fixtures/staff.fixtures.ts';
import { appFixtures, resetAppFixtures } from './fixtures/world.fixtures.ts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(appInstant('2026-10-03', '10:00')));
  resetAppFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetAppFixtures();
});

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  );
const status = (error: unknown) => (isHttpError(error) ? error.status : null);
const patient = (name: string) =>
  appFixtures.patients.snapshot((row) => row.id === patientRef(name))[0];

describe('ensureContactThread — the lookup', () => {
  it('returns the lead the record names', async () => {
    const { lead, created } = await ensureContactThread({
      name: 'Kinjal Vora',
      leadId: ref.lead(2374),
    });
    expect([lead.seq, created]).toEqual([2374, false]);
  });

  it('returns a patient’s own lead — the latest — before any contact thread', async () => {
    const { lead } = await ensureContactThread({
      name: 'Rhea Shah',
      patientId: patientRef('Rhea Shah'),
    });
    expect(lead).toMatchObject({ seq: 2365, isContactThread: false });
  });

  it('returns a patient’s contact thread when they have no lead', async () => {
    const { lead, created } = await ensureContactThread({
      name: 'Neha Gupta',
      patientId: patientRef('Neha Gupta'),
    });
    expect([lead.seq, lead.kind, created]).toEqual([2372, 'contact_thread', false]);
  });

  it('finds a contact by mobile when there is no patient record — never by name', async () => {
    const { lead } = await ensureContactThread({
      name: 'Someone else entirely',
      phone: '+919879561220',
    });
    expect(lead.seq).toBe(2374);
  });
});

describe('ensureContactThread — opening a thread', () => {
  it('opens one contact thread for the person and seeds it — once', async () => {
    const meera = patient('Meera Joshi');
    const first = await ensureContactThread({
      name: 'Meera Joshi',
      patientId: meera?.id ?? null,
      context: { kind: 'appointment', appointmentId: ref.appointment(2841) },
    });
    expect(first.created).toBe(true);
    expect(first.lead).toMatchObject({
      name: 'Meera Joshi',
      phone: meera?.phone,
      kind: 'contact_thread',
      isContactThread: true,
      status: null,
      source: null,
      interests: ['hydrafacial'],
      ownerId: FIXTURE_VIEWER_ID,
      patientId: meera?.id,
      branchId: meera?.homeBranchId,
      seq: 2386,
    });
    expect(
      appFixtures.leadMessages.snapshot((message) => message.leadId === first.lead.id),
    ).toMatchObject([
      { body: 'Appointment #2841 · Hydrafacial', isSystem: true, channel: 'note' },
    ]);

    const again = await ensureContactThread({
      name: 'Meera Joshi',
      patientId: meera?.id ?? null,
    });
    expect([again.lead.id, again.created]).toEqual([first.lead.id, false]);
    expect(
      appFixtures.leads.snapshot((lead) => lead.patientId === meera?.id),
    ).toHaveLength(1);
  });

  it('seeds a task’s thread with its appointment, or else the task’s title', async () => {
    const tasks = appFixtures.tasks.snapshot();
    const recall = tasks.find((row) => row.title === 'Recall Tanvi');
    const { lead } = await ensureContactThread({
      name: 'Tanvi Shah',
      patientId: patientRef('Tanvi Shah'),
      context: { kind: 'task', taskId: recall?.id ?? '' },
    });
    expect(
      appFixtures.leadMessages.snapshot((message) => message.leadId === lead.id)[0],
    ).toMatchObject({ body: 'Task · Recall Tanvi', taskId: recall?.id });

    const feedback = tasks.find((row) => row.title === 'Ask Meera how it went');
    const meera = await ensureContactThread({
      name: 'Meera Joshi',
      patientId: patientRef('Meera Joshi'),
      context: { kind: 'task', taskId: feedback?.id ?? '' },
    });
    expect(
      appFixtures.leadMessages.snapshot((message) => message.leadId === meera.lead.id)[0]
        ?.body,
    ).toBe('Appointment #2841 · Hydrafacial');
  });

  it('refuses a person it cannot identify, an unknown patient, or a contact with no mobile', async () => {
    expect(status(await failure(ensureContactThread({ name: 'Nobody' })))).toBe(422);
    expect(
      status(
        await failure(ensureContactThread({ name: 'Ghost', patientId: ref.patient(1) })),
      ),
    ).toBe(404);
    expect(
      status(
        await failure(
          ensureContactThread({
            name: 'Walk-in',
            phone: '+919999999999',
            context: { kind: 'appointment', appointmentId: ref.appointment(9999) },
          }),
        ),
      ),
    ).toBe(404);
  });
});

describe('the pure lookup', () => {
  it('skips deleted leads and finds nothing for a stranger', () => {
    const leads = appFixtures.leads.snapshot();
    const kinjal = leads.find((lead) => lead.seq === 2374);
    const deleted = leads.map((lead) =>
      lead.seq === 2374 ? { ...lead, deletedAt: '2026-10-03T04:00:00.000Z' } : lead,
    );
    expect(
      findPersonThread(leads, {
        leadId: null,
        patientId: null,
        phone: kinjal?.phone ?? null,
      })?.seq,
    ).toBe(2374);
    expect(
      findPersonThread(deleted, {
        leadId: null,
        patientId: null,
        phone: kinjal?.phone ?? null,
      }),
    ).toBeNull();
    expect(
      findPersonThread(leads, { leadId: null, patientId: null, phone: '+919000000000' }),
    ).toBeNull();
  });

  it('turns a booked service into the lead interest it stands for', () => {
    expect(interestsForService('LHR Treatment')).toEqual(['lhr']);
    expect(interestsForService('Laser hair reduction')).toEqual(['lhr']);
    expect(interestsForService('Chemical peel + consult')).toEqual(['peel']);
    expect(interestsForService('Hydrafacial')).toEqual(['hydrafacial']);
    expect(interestsForService('PRP for hair')).toEqual(['prp']);
    expect(interestsForService('Consultation')).toEqual(['others']);
  });
});
