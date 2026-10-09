import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import { clinicInstant } from './clinic-time.ts';
import {
  claimLead,
  countOpenLeadTasks,
  countUnrepliedLeads,
  createLead,
  deleteLead,
  fetchLead,
  leadListQuery,
  listLeads,
  releaseLead,
  restoreLead,
  updateLead,
} from './leads-api.ts';
import type { LeadFields } from './leads-contracts.ts';

/** The clinic's day every range here is read on. */
const TODAY = '2026-10-03';
/** Midnight at the start of a clinic day, as the API's instant. */
const midnight = (date: string) => clinicInstant(date, '00:00');

const LEAD_ID = 'lead_anaya0000000000000000';
const CONTACT_ID = 'con_anaya0000000000000000';
const RIYA = 'mem_riya00000000000000000';
const NIDHI = 'mem_nidhi0000000000000000';

/** A lead as clinozy-be answers it. */
const leadRow = (patch: Record<string, unknown> = {}) => ({
  id: LEAD_ID,
  lead_number: 2363,
  contact_id: CONTACT_ID,
  contact: {
    contact_number: 10234,
    first_name: 'Anaya',
    last_name: 'Desai',
    primary_phone: '+919879521034',
    default_channel: 'whatsapp',
  },
  patient_id: null,
  status: 'new',
  source: 'whatsapp',
  interests: ['clinical'],
  kind: 'enquiry',
  retarget_reason: null,
  owner_membership_id: NIDHI,
  involved_membership_ids: [RIYA],
  held_until: '2026-10-05T04:30:00.000Z',
  follow_up_at: null,
  branch_id: null,
  notes: null,
  last_activity_at: '2026-10-02T04:30:00.000Z',
  is_awaiting_reply: true,
  created_at: '2026-09-30T04:30:00.000Z',
  updated_at: '2026-10-02T04:30:00.000Z',
  ...patch,
});

/** One list page as clinozy-be answers it. */
const page = (
  rows: unknown[],
  pagination: { next?: string | null; has_more?: boolean; estimated_total?: number } = {},
) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 50, next: null, has_more: false, ...pagination },
  },
});

/** Every field a drawer save sends. */
const FIELDS: LeadFields = {
  status: 'follow_up',
  source: 'instagram',
  interests: ['peel', 'others'],
  ownerId: RIYA,
  involvedIds: [NIDHI],
  followUpAt: '2026-10-04T05:30:00.000Z',
  branchId: 'brn_main000000000000000000',
  notes: 'Call after six',
};

/** The same fields as the API names them. */
const FIELDS_BODY = {
  status: 'follow_up',
  source: 'instagram',
  interests: ['peel', 'others'],
  owner_membership_id: RIYA,
  involved_membership_ids: [NIDHI],
  follow_up_at: '2026-10-04T05:30:00.000Z',
  branch_id: 'brn_main000000000000000000',
  notes: 'Call after six',
};

/** The body the last PATCH sent. */
function lastPatchBody(): Record<string, unknown> {
  const init = vi.mocked(api.patch).mock.lastCall?.[1] as
    { body?: Record<string, unknown> } | undefined;
  return init?.body ?? {};
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('leadListQuery', () => {
  it('reads everyone’s leads, newest first, fifty a page, for All', () => {
    expect(leadListQuery({ view: 'all', viewerId: RIYA }, TODAY)).toEqual({ limit: 50 });
  });

  it('reads the viewer’s own leads for Mine, and those awaiting their reply for Unreplied', () => {
    expect(leadListQuery({ view: 'mine', viewerId: RIYA }, TODAY)).toEqual({
      limit: 50,
      owner_membership_id: RIYA,
    });
    expect(leadListQuery({ view: 'unreplied', viewerId: RIYA }, TODAY)).toEqual({
      limit: 50,
      owner_membership_id: RIYA,
      is_awaiting_reply: 'true',
    });
  });

  it('sends the search, the status, the sources joined and the one team member', () => {
    expect(
      leadListQuery(
        {
          view: 'all',
          viewerId: RIYA,
          q: 'anaya',
          status: 'follow_up',
          source: ['google', 'facebook'],
          member: NIDHI,
        },
        TODAY,
      ),
    ).toEqual({
      limit: 50,
      q: 'anaya',
      status: 'follow_up',
      source: 'google,facebook',
      team_membership_id: NIDHI,
    });
    expect(leadListQuery({ view: 'all', viewerId: null, source: [] }, TODAY)).toEqual({
      limit: 50,
    });
  });

  it.each([
    ['open', 'open'],
    ['soon', 'releasing_today'],
    ['held', 'held'],
  ] as const)('names the %s ownership filter "%s"', (hold, ownership) => {
    expect(leadListQuery({ view: 'all', viewerId: null, hold }, TODAY)).toEqual({
      limit: 50,
      ownership,
    });
  });

  it.each([
    ['today', midnight('2026-10-03'), midnight('2026-10-04')],
    ['yesterday', midnight('2026-10-02'), midnight('2026-10-03')],
    ['last_7', midnight('2026-09-27'), midnight('2026-10-04')],
    ['last_30', midnight('2026-09-04'), midnight('2026-10-04')],
    ['this_month', midnight('2026-10-01'), midnight('2026-11-01')],
    ['2026-07-01..2026-08-31', midnight('2026-07-01'), midnight('2026-09-01')],
  ] as const)(
    'turns the %s Created filter into whole clinic days',
    (created, from, to) => {
      expect(leadListQuery({ view: 'all', viewerId: null, created }, TODAY)).toEqual({
        limit: 50,
        created_from: from,
        created_to: to,
      });
    },
  );

  it('reads the clinic’s midnight as an instant: 18:30 UTC the evening before', () => {
    expect(
      leadListQuery({ view: 'all', viewerId: null, created: 'today' }, TODAY),
    ).toMatchObject({
      created_from: '2026-10-02T18:30:00.000Z',
      created_to: '2026-10-03T18:30:00.000Z',
    });
  });

  it.each([
    ['overdue', undefined, midnight('2026-10-03')],
    ['today', midnight('2026-10-03'), midnight('2026-10-04')],
    ['tomorrow', midnight('2026-10-04'), midnight('2026-10-05')],
    ['next_7', midnight('2026-10-03'), midnight('2026-10-11')],
    ['2026-10-10..2026-10-12', midnight('2026-10-10'), midnight('2026-10-13')],
  ] as const)(
    'turns the %s Follow-up filter into a follow_up_at range',
    (followUp, from, to) => {
      expect(leadListQuery({ view: 'all', viewerId: null, followUp }, TODAY)).toEqual({
        limit: 50,
        follow_up_at_from: from,
        follow_up_at_to: to,
      });
    },
  );

  it.each([
    ['name', 'name'],
    ['status', 'status'],
    ['source', 'source'],
    ['activity', 'last_activity_at'],
  ] as const)('sorts by %s as "%s", in the order asked', (sort, apiSort) => {
    expect(
      leadListQuery({ view: 'all', viewerId: null, sort, order: 'desc' }, TODAY),
    ).toEqual({ limit: 50, sort: apiSort, order: 'desc' });
  });

  it('sends no order without a sort — the list runs newest first', () => {
    expect(leadListQuery({ view: 'all', viewerId: null, order: 'asc' }, TODAY)).toEqual({
      limit: 50,
    });
  });

  it('reads the ranges on the clinic’s today when none is given', () => {
    expect(leadListQuery({ view: 'all', viewerId: null, created: 'today' })).toEqual(
      leadListQuery({ view: 'all', viewerId: null, created: 'today' }, TODAY),
    );
  });
});

describe('listLeads', () => {
  it('reads one page for the params and maps every row', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([leadRow()], {
        next: 'cursor-2',
        has_more: true,
        estimated_total: 73,
      }) as never,
    );

    const result = await listLeads({ view: 'mine', viewerId: RIYA, q: 'anaya' });

    expect(api.get).toHaveBeenCalledWith('/app/leads', {
      query: {
        limit: 50,
        q: 'anaya',
        owner_membership_id: RIYA,
        after: undefined,
      },
    });
    expect(result.next).toBe('cursor-2');
    expect(result.total).toBe(73);
    expect(result.rows).toEqual([
      {
        id: LEAD_ID,
        leadNumber: 2363,
        contactId: CONTACT_ID,
        person: {
          contactNumber: 10234,
          firstName: 'Anaya',
          lastName: 'Desai',
          name: 'Anaya Desai',
          primaryPhone: '+919879521034',
          defaultChannel: 'whatsapp',
        },
        name: 'Anaya Desai',
        phone: '+919879521034',
        patientId: null,
        status: 'new',
        source: 'whatsapp',
        interests: ['clinical'],
        kind: 'enquiry',
        retargetReason: null,
        ownerId: NIDHI,
        involvedIds: [RIYA],
        heldUntil: '2026-10-05T04:30:00.000Z',
        followUpAt: null,
        branchId: null,
        notes: null,
        lastActivityAt: '2026-10-02T04:30:00.000Z',
        isAwaitingReply: true,
        createdAt: '2026-09-30T04:30:00.000Z',
        updatedAt: '2026-10-02T04:30:00.000Z',
      },
    ]);
  });

  it('asks for the page after the cursor it is given', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([]) as never);
    await listLeads({ view: 'all', viewerId: null }, 'cursor-2');
    expect(api.get).toHaveBeenCalledWith('/app/leads', {
      query: { limit: 50, after: 'cursor-2' },
    });
  });

  it('gives no next cursor on the last page, whatever cursor the answer carries', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([leadRow()], { next: 'stale', has_more: false }) as never,
    );
    const result = await listLeads({ view: 'all', viewerId: null });
    expect(result.next).toBeNull();
    expect(result.total).toBeNull();
  });

  it('reads a person who is gone as no name and no number', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([leadRow({ contact: null })]) as never);
    const [row] = (await listLeads({ view: 'all', viewerId: null })).rows;
    expect(row).toMatchObject({ person: null, name: '', phone: null });
  });

  it('reads an answer without rows as an empty page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: undefined } as never);
    expect(await listLeads({ view: 'all', viewerId: null })).toEqual({
      rows: [],
      next: null,
      total: null,
    });
  });
});

describe('fetchLead', () => {
  it('reads one lead by its id', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: leadRow({ notes: 'Hi' }) } as never);
    const lead = await fetchLead(LEAD_ID);
    expect(api.get).toHaveBeenCalledWith('/app/leads/{lead_id}', {
      params: { lead_id: LEAD_ID },
    });
    expect(lead).toMatchObject({ id: LEAD_ID, name: 'Anaya Desai', notes: 'Hi' });
  });

  it('refuses an answer that is not a lead', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: LEAD_ID } } as never);
    await expect(fetchLead(LEAD_ID)).rejects.toThrow();
  });
});

describe('countUnrepliedLeads', () => {
  it('is 0 without a viewer, and reads nothing', async () => {
    expect(await countUnrepliedLeads(null)).toBe(0);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('reads the estimated total of the viewer’s leads awaiting a reply', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([leadRow()], { estimated_total: 4 }) as never,
    );
    expect(await countUnrepliedLeads(RIYA)).toBe(4);
    expect(api.get).toHaveBeenCalledWith('/app/leads', {
      query: { limit: 1, owner_membership_id: RIYA, is_awaiting_reply: 'true' },
    });
  });
});

describe('countOpenLeadTasks', () => {
  it('reads the estimated total of everyone’s open tasks on the lead', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([{}], { estimated_total: 2 }) as never);
    expect(await countOpenLeadTasks(LEAD_ID)).toBe(2);
    expect(api.get).toHaveBeenCalledWith('/app/tasks', {
      query: { limit: 1, tab: 'open', scope: 'everyone', lead_id: LEAD_ID },
    });
  });
});

describe('createLead', () => {
  it('creates a lead for someone already known by their contact id', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: leadRow() } as never);

    const created = await createLead({
      person: { contactId: CONTACT_ID },
      fields: FIELDS,
      idempotencyKey: 'key-create',
    });

    expect(api.post).toHaveBeenCalledWith('/app/leads', {
      body: { contact_id: CONTACT_ID, ...FIELDS_BODY },
      idempotencyKey: 'key-create',
    });
    expect(created).toMatchObject({ id: LEAD_ID, leadNumber: 2363 });
  });

  it('creates a new person with the lead, the first number their primary', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: leadRow() } as never);

    await createLead({
      person: {
        contact: {
          firstName: 'Hetal',
          lastName: null,
          phones: [
            { phone: '+919898012345', isOnWhatsapp: true },
            { phone: '+919898012346', isOnWhatsapp: false },
          ],
          instagramHandles: ['hetal.p'],
          defaultChannel: 'call',
          preferenceTags: ['no_calls'],
        },
      },
      fields: FIELDS,
      idempotencyKey: 'key-new-person',
    });

    expect(api.post).toHaveBeenCalledWith('/app/leads', {
      body: {
        contact: {
          first_name: 'Hetal',
          last_name: null,
          phones: [
            { phone: '+919898012345', is_primary: true, is_on_whatsapp: true },
            { phone: '+919898012346', is_primary: false, is_on_whatsapp: false },
          ],
          instagram_handles: ['hetal.p'],
          default_channel: 'call',
          preference_tags: ['no_calls'],
        },
        ...FIELDS_BODY,
      },
      idempotencyKey: 'key-new-person',
    });
  });
});

describe('updateLead', () => {
  it('sends the changed fields with the read’s updated_at — a drawer save', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: leadRow({ status: 'contacted' }),
    } as never);

    const saved = await updateLead({
      leadId: LEAD_ID,
      fields: { status: 'contacted', notes: null },
      expectedUpdatedAt: '2026-10-02T04:30:00.000Z',
      idempotencyKey: 'key-save',
    });

    expect(api.patch).toHaveBeenCalledWith('/app/leads/{lead_id}', {
      params: { lead_id: LEAD_ID },
      body: {
        status: 'contacted',
        notes: null,
        expected_updated_at: '2026-10-02T04:30:00.000Z',
      },
      idempotencyKey: 'key-save',
    });
    expect(saved.status).toBe('contacted');
  });

  it('sends no updated_at for a quick toggle', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: leadRow() } as never);

    await updateLead({
      leadId: LEAD_ID,
      fields: { involvedIds: [RIYA, NIDHI] },
      idempotencyKey: 'key-toggle',
    });

    expect(api.patch).toHaveBeenCalledWith('/app/leads/{lead_id}', {
      params: { lead_id: LEAD_ID },
      body: { involved_membership_ids: [RIYA, NIDHI] },
      idempotencyKey: 'key-toggle',
    });
    expect(lastPatchBody().expected_updated_at).toBeUndefined();
  });

  it('names every field the API’s way', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: leadRow() } as never);
    await updateLead({ leadId: LEAD_ID, fields: FIELDS, idempotencyKey: 'key-all' });
    expect(lastPatchBody()).toEqual(FIELDS_BODY);
  });
});

describe('claim, release and restore', () => {
  it('claims a lead with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: leadRow({ owner_membership_id: RIYA }),
    } as never);
    const claimed = await claimLead(LEAD_ID, 'key-claim');
    expect(api.post).toHaveBeenCalledWith('/app/leads/{lead_id}/claim', {
      params: { lead_id: LEAD_ID },
      idempotencyKey: 'key-claim',
    });
    expect(claimed.ownerId).toBe(RIYA);
  });

  it('releases a lead with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: leadRow({ held_until: null }),
    } as never);
    const released = await releaseLead(LEAD_ID, 'key-release');
    expect(api.post).toHaveBeenCalledWith('/app/leads/{lead_id}/release', {
      params: { lead_id: LEAD_ID },
      idempotencyKey: 'key-release',
    });
    expect(released.heldUntil).toBeNull();
  });

  it('restores a deleted lead with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: leadRow() } as never);
    const restored = await restoreLead(LEAD_ID, 'key-restore');
    expect(api.post).toHaveBeenCalledWith('/app/leads/{lead_id}/restore', {
      params: { lead_id: LEAD_ID },
      idempotencyKey: 'key-restore',
    });
    expect(restored.id).toBe(LEAD_ID);
  });
});

describe('deleteLead', () => {
  it('sends the reason and the note', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined } as never);
    await deleteLead({ leadId: LEAD_ID, reason: 'other', note: 'Spam number' });
    expect(api.delete).toHaveBeenCalledWith('/app/leads/{lead_id}', {
      params: { lead_id: LEAD_ID },
      reason: 'other',
      note: 'Spam number',
    });
  });

  it('sends no note when there is none', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined } as never);
    await deleteLead({ leadId: LEAD_ID, reason: 'duplicate', note: null });
    expect(api.delete).toHaveBeenCalledWith('/app/leads/{lead_id}', {
      params: { lead_id: LEAD_ID },
      reason: 'duplicate',
      note: undefined,
    });
  });
});
