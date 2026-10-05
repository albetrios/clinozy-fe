import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  assignLead,
  claimLead,
  convertLead,
  countOpenLeadTasks,
  countUnrepliedLeads,
  createLead,
  deleteLead,
  fetchLead,
  fetchLeadViewer,
  findOpenLeadByPhone,
  LEAD_CONTACT_SEARCH_LIMIT,
  leadQueryKeys,
  listLeads,
  markLeadRead,
  releaseLead,
  restoreLead,
  restoreLeadTeam,
  saveLead,
  searchLeadContacts,
  undoLeadChange,
  updateLead,
} from './leads-api.ts';
import type { LeadListParams } from './leads-contracts.ts';
import { LEAD_HOLD_DAYS, leadHold } from './leads-hold.ts';
import { fetchTaskPage } from './tasks-api.ts';

const RS = staffRef('RS');
const NK = staffRef('NK');
const DR = staffRef('DR');
const AS = staffRef('AS');
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

const seqs = async (params: LeadListParams = {}) =>
  (await listLeads(params)).items.map((lead) => lead.seq);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('leadQueryKeys', () => {
  it('nests every key under the domain, so one invalidation reaches them all', () => {
    expect(leadQueryKeys.list({ view: 'all' })).toEqual([
      'clinic',
      'leads',
      'list',
      { view: 'all' },
    ]);
    expect(leadQueryKeys.detail('L1').slice(0, 2)).toEqual(leadQueryKeys.all);
    expect(leadQueryKeys.unreplied(RS).slice(0, 3)).toEqual(
      leadQueryKeys.unrepliedCounts(),
    );
  });
});

describe('the leads list (listLeads, S:1588)', () => {
  it('reads the seventeen leads newest first — never a contact thread', async () => {
    const page = await listLeads();
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((lead) => lead.seq)).toEqual([
      2363, 2364, 2365, 2371, 2362, 2361, 2360, 2359, 2370, 2358, 2357, 2356, 2355, 2354,
      2353, 2352, 2210,
    ]);
    expect(page.items.some((lead) => lead.isContactThread)).toBe(false);
  });

  it('reads the views: Mine, Unreplied (mine with unread messages) and All', async () => {
    expect(await seqs({ view: 'mine', viewerId: RS })).toEqual([
      2363, 2365, 2356, 2355, 2354, 2353,
    ]);
    expect(await seqs({ view: 'unread', viewerId: RS })).toEqual([2363, 2365]);
    expect(await seqs({ view: 'unread', viewerId: NK })).toEqual([]);
    expect(await seqs({ view: 'all', viewerId: RS })).toHaveLength(17);
  });

  it('matches nothing for "mine" without a viewer — never the leads nobody owns', async () => {
    expect(await seqs({ view: 'mine', viewerId: null })).toEqual([]);
    expect(await seqs({ view: 'unread' })).toEqual([]);
  });

  it('filters by status and by any of several sources', async () => {
    expect(await seqs({ status: ['follow_up'] })).toEqual([2362, 2360, 2359, 2358, 2354]);
    expect(await seqs({ source: ['google', 'facebook'] })).toEqual([2361, 2359, 2357]);
  });

  it('filters the team as owner or involved (H:5636)', async () => {
    expect(await seqs({ owner: [NK] })).toEqual([
      2363, 2364, 2371, 2370, 2358, 2352, 2210,
    ]);
  });

  it('filters ownership on the hold: open, releasing later today, held', async () => {
    // Asha has left the clinic, so her lead is open to anyone.
    expect(await seqs({ hold: 'open' })).toEqual([2362]);
    // Touched 30 Sep at 16:34 and 15:10: three days on is later today.
    expect(await seqs({ hold: 'soon' })).toEqual([2356, 2354]);
    expect(await seqs({ hold: 'held' })).toEqual([
      2363, 2364, 2361, 2360, 2359, 2358, 2357, 2356, 2354,
    ]);
  });

  it('filters on the created and follow-up dates', async () => {
    expect(await seqs({ created: 'today' })).toEqual([2363, 2364, 2365, 2371]);
    expect(await seqs({ created: 'yesterday' })).toEqual([2362, 2361, 2360, 2359, 2370]);
    expect(await seqs({ created: 'last_7' })).toHaveLength(15);
    expect(await seqs({ created: '2026-07-01..2026-08-31' })).toEqual([2352, 2210]);
    // #2360 "Will call Monday": its follow-up is tomorrow.
    expect(await seqs({ followUp: 'tomorrow' })).toEqual([2360]);
    expect(await seqs({ followUp: 'not_set' })).toHaveLength(16);
  });

  it('searches the name, the mobile and "#id", ignoring spaces and "#" (H:5630)', async () => {
    expect(await seqs({ q: 'rhea' })).toEqual([2365, 2210]);
    expect(await seqs({ q: '98250 11241' })).toEqual([2365, 2210]);
    expect(await seqs({ q: '#2363' })).toEqual([2363]);
    expect(await seqs({ q: 'Kabir Meh' })).toEqual([2364]);
    expect(await seqs({ q: '  ' })).toHaveLength(17);
  });

  it('combines the view with the filters', async () => {
    expect(await seqs({ view: 'mine', viewerId: RS, status: ['new'] })).toEqual([
      2363, 2365,
    ]);
  });

  it('sorts by name, pipeline order, source or update, ascending unless told otherwise', async () => {
    const byName = await listLeads({ sort: 'name' });
    expect(byName.items.map((lead) => lead.name).slice(0, 3)).toEqual([
      'Akshar Gajera',
      'Alpa Bambhroliya',
      'Anaya Desai',
    ]);
    // Equal names fall back to the newest id.
    expect(
      (await seqs({ sort: 'name' })).filter((seq) => [2365, 2210].includes(seq)),
    ).toEqual([2365, 2210]);
    expect((await seqs({ sort: 'status' })).slice(0, 4)).toEqual([
      2371, 2365, 2363, 2361,
    ]);
    expect((await seqs({ sort: 'status', order: 'desc' }))[0]).toBe(2353);
    expect((await listLeads({ sort: 'source' })).items[0]?.source).toBe('facebook');
    const updated = (await listLeads({ sort: 'updated', order: 'desc' })).items.map(
      (lead) => lead.updatedAt,
    );
    expect(updated).toEqual([...updated].sort().reverse());
  });

  it('pages by fifty with a cursor', async () => {
    for (let index = 0; index < 40; index += 1) {
      await createLead({
        name: `Walk-in ${index}`,
        phone: `+9170000${String(index).padStart(5, '0')}`,
      });
    }
    const first = await listLeads();
    expect(first.items).toHaveLength(50);
    const second = await listLeads({}, first.nextCursor);
    expect(second.items).toHaveLength(7);
    expect(second.nextCursor).toBeNull();
  });
});

describe('one lead (getLead, S:1589)', () => {
  it('reads it by id', async () => {
    expect((await fetchLead(ref.lead(2363))).name).toBe('Anaya Desai');
  });

  it('answers 404 for an unknown id, a contact thread or a deleted lead (S:115)', async () => {
    expect((await failureOf(fetchLead(ref.lead(1)))).status).toBe(404);
    const thread = await failureOf(fetchLead(ref.lead(2372)));
    expect(thread).toMatchObject({ status: 404, detail: 'Lead not found' });
    await deleteLead(ref.lead(2357), 'duplicate', null);
    expect((await failureOf(fetchLead(ref.lead(2357)))).status).toBe(404);
  });
});

describe('the Unreplied count', () => {
  it('counts the viewer’s leads with unread messages', async () => {
    expect(await countUnrepliedLeads(RS)).toBe(2);
    expect(await countUnrepliedLeads(NK)).toBe(0);
    expect(await countUnrepliedLeads(null)).toBe(0);
  });
});

describe('the Leads room’s viewer (fetchLeadViewer)', () => {
  it('reads the member by sign-in email, ignoring case and spaces', async () => {
    expect((await fetchLeadViewer(' Nidhi@Cresence.SKIN '))?.id).toBe(NK);
    expect(leadQueryKeys.viewer('nidhi@cresence.skin').slice(0, 2)).toEqual(
      leadQueryKeys.all,
    );
  });

  it('falls back to the fixture server’s own member — never nobody', async () => {
    expect((await fetchLeadViewer('someone@else.test'))?.id).toBe(RS);
    expect((await fetchLeadViewer('  '))?.id).toBe(RS);
    expect((await fetchLeadViewer(null))?.id).toBe(RS);
  });
});

describe('New lead’s contact search (searchLeadContacts)', () => {
  it('searches from two characters, at most five people', async () => {
    expect(await searchLeadContacts('r')).toEqual([]);
    expect(await searchLeadContacts(' ')).toEqual([]);
    expect(await searchLeadContacts('a')).toHaveLength(0);
    expect((await searchLeadContacts('sh')).length).toBeLessThanOrEqual(
      LEAD_CONTACT_SEARCH_LIMIT,
    );
  });

  it('finds a patient by name with their last visit, before anyone else', async () => {
    const patient = clinicFixtures.patients.snapshot()[0]!;
    const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
    const hits = await searchLeadContacts(name);
    expect(hits[0]).toMatchObject({
      kind: 'patient',
      id: patient.id,
      seq: patient.seq,
      name,
      phone: patient.phone,
    });
    const visits = clinicFixtures.appointments
      .snapshot(
        (visit) =>
          visit.patientId === patient.id &&
          ['checked_in', 'completed'].includes(visit.status) &&
          visit.date <= '2026-10-03',
      )
      .map((visit) => visit.date)
      .sort();
    expect(hits[0]).toMatchObject({ lastVisit: visits.at(-1) ?? null });
  });

  it('finds a person known only as a lead by their mobile, once, with their contact', async () => {
    const patientPhones = new Set(
      clinicFixtures.patients
        .snapshot()
        .flatMap((patient) => [patient.phone, patient.phone2]),
    );
    const lead = clinicFixtures.leads
      .snapshot((row) => row.patientId === null && !patientPhones.has(row.phone))
      .sort((a, b) => b.seq - a.seq)[0]!;
    const hits = await searchLeadContacts(lead.phone.slice(-6));
    const mine = hits.filter((hit) => hit.kind === 'lead' && hit.phone === lead.phone);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      kind: 'lead',
      name: lead.name,
      contactThread: lead.isContactThread,
    });
  });

  it('never offers a lead whose mobile is a patient’s — the patient stands for them', async () => {
    const patient = clinicFixtures.patients.snapshot()[0]!;
    const hits = await searchLeadContacts(patient.phone.slice(-7));
    expect(hits.some((hit) => hit.kind === 'lead' && hit.phone === patient.phone)).toBe(
      false,
    );
    expect(leadQueryKeys.contactSearch('rh').slice(0, 2)).toEqual(leadQueryKeys.all);
  });
});

describe('createLead (S:1593)', () => {
  it('creates from a name and a mobile — New, from WhatsApp, its hold starting now', async () => {
    const created = await createLead({ name: '  Hetal Parmar ', phone: '+919898012345' });
    expect(created).toMatchObject({
      seq: 2386,
      name: 'Hetal Parmar',
      status: 'new',
      source: 'whatsapp',
      kind: 'enquiry',
      isContactThread: false,
      interests: [],
      customInterests: [],
      ownerId: null,
      involvedIds: [],
      touchedAt: NOW.toISOString(),
      releasedAt: null,
      unreadCount: 0,
      deletedAt: null,
    });
  });

  it('puts the new lead first in the list (D28)', async () => {
    // Past every seed's time today (Anaya wrote at 10:28).
    vi.setSystemTime(new Date('2026-10-03T06:30:00Z'));
    await createLead({ name: 'Hetal Parmar', phone: '+919898012345' });
    expect((await seqs())[0]).toBe(2386);
  });

  it('takes the presets, a linked patient, and tidies the people and interests', async () => {
    const created = await createLead({
      name: 'Rhea Shah',
      phone: '+919099055120',
      status: 'contacted',
      source: 'phone_call',
      patientId: patientRef('Rhea Shah'),
      ownerId: RS,
      involvedIds: [RS, NK, NK],
      interests: ['lhr', 'lhr'],
      customInterests: [' Acne scars ', 'acne SCARS', 'LHR', 'Under-eye'],
      branchId: branchRef(MAIN_BRANCH),
    });
    expect(created).toMatchObject({
      status: 'contacted',
      source: 'phone_call',
      ownerId: RS,
      involvedIds: [NK],
      interests: ['lhr'],
      customInterests: ['Acne scars', 'Under-eye'],
    });
  });

  it('keeps the contact’s numbers and handles, its first number the lead’s mobile', async () => {
    const created = await createLead({
      name: 'Rhea Shah',
      phone: '+919898012345',
      contact: {
        phones: [
          { phone: '+919712300001', whatsapp: true },
          { phone: '+919712300002', whatsapp: false },
        ],
        instagram: ['@rhea'],
        defaultChannel: 'call',
        preferences: ['No calls'],
      },
    });
    expect(created.phone).toBe('+919712300001');
    expect(created.contact).toMatchObject({
      phones: [{ whatsapp: true }, { phone: '+919712300002', whatsapp: false }],
      instagram: ['@rhea'],
      defaultChannel: 'call',
    });
  });

  it('answers 422 naming the field: no name, no 10-digit mobile, people or places the clinic lacks', async () => {
    expect(
      await failureOf(createLead({ name: ' ', phone: '+919898012345' })),
    ).toMatchObject({
      status: 422,
      detail: 'Add a name',
      fields: { name: ['Add a name'] },
    });
    expect(await failureOf(createLead({ name: 'Hetal', phone: '98980' }))).toMatchObject({
      status: 422,
      fields: { phone: ['Add a 10-digit mobile'] },
    });
    expect(
      await failureOf(
        createLead({ name: 'Hetal', phone: '+919898012345', ownerId: ref.user(99) }),
      ),
    ).toMatchObject({ status: 422, fields: { ownerId: ['Pick someone on the team'] } });
    expect(
      (
        await failureOf(
          createLead({ name: 'Hetal', phone: '+919898012345', branchId: ref.branch(9) }),
        )
      ).fields,
    ).toHaveProperty('branchId');
    expect(
      (
        await failureOf(
          createLead({
            name: 'Hetal',
            phone: '+919898012345',
            patientId: ref.patient(1),
          }),
        )
      ).fields,
    ).toHaveProperty('patientId');
  });

  it('answers 409 when the mobile is already on an open lead, and finds that lead for "Open"', async () => {
    expect(
      await failureOf(createLead({ name: 'Anaya D', phone: '+919879521034' })),
    ).toMatchObject({
      status: 409,
      code: 'conflict',
      fields: { phone: [expect.any(String)] },
    });
    expect((await findOpenLeadByPhone('+919879521034'))?.seq).toBe(2363);
    // Rhea's first lead is closed; her open one (#2365) is the match.
    expect((await findOpenLeadByPhone('+919825011241'))?.seq).toBe(2365);
  });

  it('lets a closed lead’s person come back as a new lead', async () => {
    // Tulsi (#2353) was Not interested.
    expect(await findOpenLeadByPhone('+917016292085')).toBeNull();
    const back = await createLead({ name: 'Tulsi', phone: '+917016292085' });
    expect(back.seq).toBe(2386);
  });
});

describe('updateLead (S:1594)', () => {
  it('moves any status to any (Q-L4) and stamps the update', async () => {
    const saved = await updateLead(ref.lead(2363), { status: 'lost' });
    expect(saved.status).toBe('lost');
    expect(saved.updatedAt).toBe(NOW.toISOString());
    expect((await updateLead(ref.lead(2363), { status: 'new' })).status).toBe('new');
  });

  it('re-checks the merged record: a lead keeps a status and a source', async () => {
    expect(await failureOf(updateLead(ref.lead(2363), { status: null }))).toMatchObject({
      status: 422,
    });
    expect(
      (await failureOf(updateLead(ref.lead(2363), { source: null }))).fields,
    ).toHaveProperty('source');
  });

  it('answers 409 only when the mobile changes onto another open lead', async () => {
    // #2365 shares Rhea's mobile with her closed #2210 — saving it is fine.
    expect(
      (await updateLead(ref.lead(2365), { interests: ['prp', 'lhr'] })).interests,
    ).toEqual(['prp', 'lhr']);
    expect(
      (await failureOf(updateLead(ref.lead(2364), { phone: '+919879521034' }))).status,
    ).toBe(409);
  });

  it('hands over to a new owner: the previous one stays involved, the hold starts again', async () => {
    const before = await fetchLead(ref.lead(2357));
    const assigned = await assignLead(ref.lead(2357), NK);
    expect(assigned).toMatchObject({ ownerId: NK, involvedIds: [DR] });
    expect(assigned.touchedAt).toBe(NOW.toISOString());
    expect(before.touchedAt).not.toBe(NOW.toISOString());
  });

  it('counts a save by the owner as their activity, not one by anyone else (Q-L9)', async () => {
    const touched = (await fetchLead(ref.lead(2356))).touchedAt;
    expect(
      (await updateLead(ref.lead(2356), { notes: 'Call later' }, NK)).touchedAt,
    ).toBe(touched);
    expect((await updateLead(ref.lead(2356), { notes: 'Called' }, RS)).touchedAt).toBe(
      NOW.toISOString(),
    );
  });

  it('edits a contact thread’s contact, which has no status or source', async () => {
    const saved = await updateLead(ref.lead(2372), { name: 'Neha Gupta K' });
    expect(saved).toMatchObject({
      name: 'Neha Gupta K',
      status: null,
      isContactThread: true,
    });
  });

  it('keeps the mobile and the contact’s first number one number, either way in', async () => {
    // #2365 is Rhea's, on two numbers (H:3382).
    const moved = await updateLead(ref.lead(2365), { phone: '+919712300003' });
    expect(moved.contact?.phones.map((entry) => entry.phone)).toEqual([
      '+919712300003',
      '+919099055120',
    ]);
    const edited = await updateLead(ref.lead(2365), {
      contact: {
        ...moved.contact!,
        phones: [{ phone: '+919712300004', whatsapp: true }],
      },
    });
    expect(edited.phone).toBe('+919712300004');
  });

  it('answers 404 for a lead that is gone', async () => {
    expect((await failureOf(updateLead(ref.lead(1), { notes: 'x' }))).status).toBe(404);
  });
});

describe('the drawer’s save and its side effects (saveLead, Q-T3)', () => {
  const messagesOf = (id: string) =>
    clinicFixtures.leadMessages.snapshot((message) => message.leadId === id);

  it('opens a follow-up task due tomorrow on Follow-up, and Undo takes it all back', async () => {
    const id = ref.lead(2363);
    const before = messagesOf(id).length;
    const saved = await saveLead(id, { status: 'follow_up' }, RS);
    expect(saved).toMatchObject({ statusMoved: true, followUpTask: true });
    expect(saved.lead.status).toBe('follow_up');
    expect(saved.lead.followUpAt).toBe('2026-10-04T05:30:00.000Z');
    expect(await countOpenLeadTasks(id)).toBe(1);
    expect(messagesOf(id).at(-1)?.body).toBe('Status → Follow-up');

    await undoLeadChange(saved.undoToken);
    const back = await fetchLead(id);
    expect(back).toMatchObject({ status: 'new', followUpAt: null });
    expect(await countOpenLeadTasks(id)).toBe(0);
    expect(messagesOf(id)).toHaveLength(before);
    expect((await failureOf(undoLeadChange(saved.undoToken))).status).toBe(409);
  });

  it('leaves one follow-up task on its due day — the follow rule counts the status’s own', async () => {
    const id = ref.lead(2363);
    const followUps = async () =>
      (await fetchTaskPage({ scope: 'everyone' })).rows
        .filter((row) => row.leadId === id && row.title.startsWith('Follow'))
        .map((row) => row.title);
    await saveLead(id, { status: 'follow_up' }, RS);
    // A second move to Follow-up the same day opens nothing more.
    await saveLead(id, { status: 'contacted' }, RS);
    await saveLead(id, { status: 'follow_up' }, RS);
    expect(await followUps()).toEqual(['Follow-up']);

    // 11:30 on the due day: the follow rule's condition is met — Follow-up, its date today.
    vi.setSystemTime(new Date('2026-10-04T06:00:00Z'));
    expect(await followUps()).toEqual(['Follow-up']);
  });

  it('opens one Call back on No response, never a second while it is open', async () => {
    const id = ref.lead(2363);
    await saveLead(id, { status: 'no_response' }, RS);
    expect(await countOpenLeadTasks(id)).toBe(1);
    await saveLead(id, { status: 'contacted' }, RS);
    await saveLead(id, { status: 'no_response' }, RS);
    expect(await countOpenLeadTasks(id)).toBe(1);
  });

  it('says nothing moved when the status stays', async () => {
    const saved = await saveLead(ref.lead(2363), { interests: ['peel'] }, RS);
    expect(saved).toMatchObject({ statusMoved: false, followUpTask: false });
  });
});

describe('convertLead', () => {
  it('creates a linked patient and moves the lead to Clinic visited; Undo removes them', async () => {
    const id = ref.lead(2363);
    const converted = await convertLead(id);
    expect(converted.lead).toMatchObject({
      status: 'clinic_visited',
      patientId: converted.patientId,
    });
    const patient = await clinicFixtures.patients.get(converted.patientId);
    expect(patient).toMatchObject({ firstName: 'Anaya', lastName: 'Desai', leadId: id });
    expect((await failureOf(convertLead(id))).status).toBe(409);

    await undoLeadChange(converted.undoToken);
    expect(await fetchLead(id)).toMatchObject({ status: 'new', patientId: null });
    expect(
      clinicFixtures.patients.snapshot((row) => row.id === converted.patientId),
    ).toHaveLength(0);
  });
});

describe('claim, release and the team’s Undo (Appendix F)', () => {
  it('claims an open lead: the viewer owns it, the previous owner stays involved, the hold restarts', async () => {
    const claimed = await claimLead(ref.lead(2362), RS);
    expect(claimed).toMatchObject({ ownerId: RS, involvedIds: [AS], releasedAt: null });
    expect(claimed.touchedAt).toBe(NOW.toISOString());
    expect(await seqs({ hold: 'open' })).toEqual([]);
  });

  it('takes over a held lead too, and leaves one already mine as it is', async () => {
    expect((await claimLead(ref.lead(2364), RS)).ownerId).toBe(RS);
    const mine = await fetchLead(ref.lead(2363));
    expect(await claimLead(ref.lead(2363), RS)).toEqual(mine);
  });

  it('refuses a closed lead (409), a stranger (422) and a contact thread (404)', async () => {
    expect((await failureOf(claimLead(ref.lead(2371), RS))).status).toBe(409);
    expect((await failureOf(claimLead(ref.lead(2364), ref.user(99)))).status).toBe(422);
    expect((await failureOf(claimLead(ref.lead(2372), RS))).status).toBe(404);
  });

  it('puts the team back for Undo', async () => {
    const before = await fetchLead(ref.lead(2362));
    await claimLead(ref.lead(2362), RS);
    const restored = await restoreLeadTeam(ref.lead(2362), before);
    expect(restored).toMatchObject({
      ownerId: AS,
      involvedIds: [],
      touchedAt: before.touchedAt,
      releasedAt: null,
    });
    expect(await seqs({ hold: 'open' })).toEqual([2362]);
  });

  it('releases the owner’s lead to the team at once', async () => {
    // Mehul (#2356) is Riya's, held until later today.
    const released = await releaseLead(ref.lead(2356), RS);
    expect(released.releasedAt).toBe(NOW.toISOString());
    const hold = leadHold({ ...released, ownerGone: false }, LEAD_HOLD_DAYS, NOW);
    expect(hold).toMatchObject({ open: true, released: true });
  });

  it('lets only the owner release (403), and never a closed lead (409)', async () => {
    expect(await failureOf(releaseLead(ref.lead(2363), NK))).toMatchObject({
      status: 403,
      detail: "You don't have access to do this",
    });
    expect((await failureOf(releaseLead(ref.lead(2355), RS))).status).toBe(409);
  });
});

describe('markLeadRead', () => {
  it('clears the unread count without touching "Updated"', async () => {
    const before = await fetchLead(ref.lead(2363));
    const read = await markLeadRead(ref.lead(2363));
    expect(read.unreadCount).toBe(0);
    expect(read.updatedAt).toBe(before.updatedAt);
    expect(await countUnrepliedLeads(RS)).toBe(1);
    expect(await markLeadRead(ref.lead(2363))).toEqual(read);
  });
});

describe('delete with a reason and restore (S:1546)', () => {
  it('soft-deletes out of every list, and restore brings it back for Undo', async () => {
    await deleteLead(ref.lead(2357), 'duplicate', null);
    expect(await seqs()).not.toContain(2357);
    expect(clinicFixtures.leads.snapshot((lead) => lead.seq === 2357)).toEqual([]);
    await restoreLead(ref.lead(2357));
    expect(await seqs()).toContain(2357);
  });

  it('needs a note for "Other" (422) and never deletes a contact thread (404)', async () => {
    expect(
      (await failureOf(deleteLead(ref.lead(2357), 'other', ' '))).fields,
    ).toHaveProperty('note');
    expect((await failureOf(deleteLead(ref.lead(2372), 'duplicate', null))).status).toBe(
      404,
    );
  });
});
