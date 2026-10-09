import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { leadQueryKeys } from './leads-api.ts';
import {
  fetchFixtureLead,
  fetchFixtureLeadViewer,
  fixtureLeadQueryKeys,
  searchFixtureLeadContacts,
  updateFixtureLead,
} from './leads-fixture-api.ts';

const RS = staffRef('RS');
const NK = staffRef('NK');
const DR = staffRef('DR');
/** 10:00 on 3 Oct, clinic time — the seed day is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (
    error.data as { error: { code: string; detail: string; fields?: object } }
  ).error;
  return { status: error.status, ...body };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('fixtureLeadQueryKeys', () => {
  it('sit under the Leads room’s keys, so its writes refresh the fixture rooms', () => {
    expect(fixtureLeadQueryKeys.all.slice(0, 2)).toEqual([...leadQueryKeys.all]);
    expect(fixtureLeadQueryKeys.detail('L1').slice(0, 3)).toEqual([
      ...fixtureLeadQueryKeys.all,
    ]);
    expect(fixtureLeadQueryKeys.viewer('nidhi@cresence.skin').slice(0, 3)).toEqual([
      ...fixtureLeadQueryKeys.all,
    ]);
  });
});

describe('fetchFixtureLead', () => {
  it('reads one fixture lead by id', async () => {
    expect((await fetchFixtureLead(ref.lead(2363))).name).toBe('Anaya Desai');
  });

  it('answers 404 for an unknown id or a contact thread', async () => {
    expect((await failureOf(fetchFixtureLead(ref.lead(1)))).status).toBe(404);
    expect(await failureOf(fetchFixtureLead(ref.lead(2372)))).toMatchObject({
      status: 404,
      detail: 'Lead not found',
    });
  });
});

describe('fetchFixtureLeadViewer', () => {
  it('reads the member by sign-in email, ignoring case and spaces', async () => {
    expect((await fetchFixtureLeadViewer(' Nidhi@Cresence.SKIN '))?.id).toBe(NK);
  });

  it('falls back to the fixture server’s own member — never nobody', async () => {
    expect((await fetchFixtureLeadViewer('someone@else.test'))?.id).toBe(RS);
    expect((await fetchFixtureLeadViewer('  '))?.id).toBe(RS);
    expect((await fetchFixtureLeadViewer(null))?.id).toBe(RS);
  });
});

describe('searchFixtureLeadContacts', () => {
  it('searches from two characters, at most five people', async () => {
    expect(await searchFixtureLeadContacts('r')).toEqual([]);
    expect(await searchFixtureLeadContacts(' ')).toEqual([]);
    expect((await searchFixtureLeadContacts('sh')).length).toBeLessThanOrEqual(5);
  });

  it('finds a patient by name with their last visit, before anyone else', async () => {
    const [patient] = clinicFixtures.patients.snapshot();
    if (!patient) throw new Error('no seeded patient');
    const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
    const visits = clinicFixtures.appointments
      .snapshot(
        (visit) =>
          visit.patientId === patient.id &&
          ['checked_in', 'completed'].includes(visit.status) &&
          visit.date <= '2026-10-03',
      )
      .map((visit) => visit.date)
      .sort((a, b) => a.localeCompare(b));

    const [first] = await searchFixtureLeadContacts(name);

    expect(first).toMatchObject({
      kind: 'patient',
      id: patient.id,
      seq: patient.seq,
      name,
      phone: patient.phone,
      lastVisit: visits.at(-1) ?? null,
    });
  });

  it('finds a person known only as a lead by their mobile, once, with their contact', async () => {
    const patientPhones = new Set(
      clinicFixtures.patients
        .snapshot()
        .flatMap((patient) => [patient.phone, patient.phone2]),
    );
    const [lead] = clinicFixtures.leads
      .snapshot((row) => row.patientId === null && !patientPhones.has(row.phone))
      .sort((a, b) => b.seq - a.seq);
    if (!lead) throw new Error('no lead-only person');

    const hits = await searchFixtureLeadContacts(lead.phone.slice(-6));

    const theirs = hits.filter((hit) => hit.kind === 'lead' && hit.phone === lead.phone);
    expect(theirs).toHaveLength(1);
    expect(theirs[0]).toMatchObject({
      kind: 'lead',
      name: lead.name,
      contactThread: lead.isContactThread,
    });
  });

  it('never offers a lead whose mobile is a patient’s — the patient stands for them', async () => {
    const [patient] = clinicFixtures.patients.snapshot();
    if (!patient) throw new Error('no seeded patient');
    const hits = await searchFixtureLeadContacts(patient.phone.slice(-7));
    expect(hits.some((hit) => hit.kind === 'lead' && hit.phone === patient.phone)).toBe(
      false,
    );
  });
});

describe('updateFixtureLead', () => {
  it('moves any status to any (Q-L4) and stamps the update', async () => {
    const saved = await updateFixtureLead(ref.lead(2363), { status: 'lost' });
    expect(saved.status).toBe('lost');
    expect(saved.updatedAt).toBe(NOW.toISOString());
    expect((await updateFixtureLead(ref.lead(2363), { status: 'new' })).status).toBe(
      'new',
    );
  });

  it('re-checks the merged record: a lead keeps a status and a source', async () => {
    expect(
      await failureOf(updateFixtureLead(ref.lead(2363), { status: null })),
    ).toMatchObject({ status: 422 });
    expect(
      (await failureOf(updateFixtureLead(ref.lead(2363), { source: null }))).fields,
    ).toHaveProperty('source');
  });

  it('refuses people the clinic lacks (422)', async () => {
    expect(
      await failureOf(updateFixtureLead(ref.lead(2363), { ownerId: ref.user(99) })),
    ).toMatchObject({ status: 422, fields: { ownerId: ['Pick someone on the team'] } });
  });

  it('answers 409 only when the mobile changes onto another open lead', async () => {
    // #2365 shares Rhea's mobile with her closed #2210 — saving it is fine.
    expect(
      (await updateFixtureLead(ref.lead(2365), { interests: ['prp', 'lhr'] })).interests,
    ).toEqual(['prp', 'lhr']);
    expect(
      await failureOf(updateFixtureLead(ref.lead(2364), { phone: '+919879521034' })),
    ).toMatchObject({
      status: 409,
      fields: { phone: ['This number is already a lead'] },
    });
  });

  it('tidies the people and interests: once each, the owner never also involved', async () => {
    const saved = await updateFixtureLead(ref.lead(2363), {
      ownerId: RS,
      involvedIds: [RS, NK, NK],
      interests: ['lhr', 'lhr'],
      customInterests: [' Acne scars ', 'acne SCARS', 'LHR', 'Under-eye'],
      notes: '   ',
    });
    expect(saved).toMatchObject({
      ownerId: RS,
      involvedIds: [NK],
      interests: ['lhr'],
      customInterests: ['Acne scars', 'Under-eye'],
      notes: null,
    });
  });

  it('hands over to a new owner: the previous one stays involved, the hold starts again', async () => {
    const before = await fetchFixtureLead(ref.lead(2357));
    const assigned = await updateFixtureLead(ref.lead(2357), { ownerId: NK });
    expect(assigned).toMatchObject({ ownerId: NK, involvedIds: [DR], releasedAt: null });
    expect(assigned.touchedAt).toBe(NOW.toISOString());
    expect(before.touchedAt).not.toBe(NOW.toISOString());
  });

  it('counts a save by the owner as their activity, not one by anyone else (Q-L9)', async () => {
    const touched = (await fetchFixtureLead(ref.lead(2356))).touchedAt;
    expect(
      (await updateFixtureLead(ref.lead(2356), { notes: 'Call later' }, NK)).touchedAt,
    ).toBe(touched);
    expect(
      (await updateFixtureLead(ref.lead(2356), { notes: 'Called' }, RS)).touchedAt,
    ).toBe(NOW.toISOString());
  });

  it('edits a contact thread’s contact, which has no status or source', async () => {
    const saved = await updateFixtureLead(ref.lead(2372), { name: 'Neha Gupta K' });
    expect(saved).toMatchObject({
      name: 'Neha Gupta K',
      status: null,
      isContactThread: true,
    });
  });

  it('keeps the mobile and the contact’s first number one number, either way in', async () => {
    // #2365 is Rhea's, on two numbers (H:3382).
    const moved = await updateFixtureLead(ref.lead(2365), { phone: '+919712300003' });
    expect(moved.contact?.phones.map((entry) => entry.phone)).toEqual([
      '+919712300003',
      '+919099055120',
    ]);
    if (!moved.contact) throw new Error('no contact');
    const edited = await updateFixtureLead(ref.lead(2365), {
      contact: { ...moved.contact, phones: [{ phone: '+919712300004', whatsapp: true }] },
    });
    expect(edited.phone).toBe('+919712300004');
  });

  it('answers 404 for a lead that is gone', async () => {
    expect((await failureOf(updateFixtureLead(ref.lead(1), { notes: 'x' }))).status).toBe(
      404,
    );
  });
});
