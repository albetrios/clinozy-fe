import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LeadsApiModule from '@/shared/api/app/leads-api.ts';
import {
  claimLead,
  countOpenLeadTasks,
  countUnrepliedLeads,
  createLead,
  deleteLead,
  fetchLead,
  leadQueryKeys,
  listLeads,
  releaseLead,
  restoreLead,
  updateLead,
} from '@/shared/api/app/leads-api.ts';
import type { LeadFields, LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import {
  useAssignLead,
  useClaimLead,
  useCreateLead,
  useDeleteLead,
  useLead,
  useLeadList,
  useOpenLeadTasks,
  useReleaseLead,
  useRestoreLead,
  useSetLeadInvolved,
  useUnrepliedLeadCount,
  useUpdateLead,
} from './useLeads.ts';

vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof LeadsApiModule>()),
  listLeads: vi.fn(),
  fetchLead: vi.fn(),
  countUnrepliedLeads: vi.fn(),
  countOpenLeadTasks: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  claimLead: vi.fn(),
  releaseLead: vi.fn(),
  deleteLead: vi.fn(),
  restoreLead: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

const RIYA = 'mem_riya00000000000000000';
const NIDHI = 'mem_nidhi0000000000000000';

/** A pipeline lead: New, WhatsApp, Clinical, Nidhi's. */
function leadRecord(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead_anaya0000000000000000',
    leadNumber: 2363,
    contactId: 'con_anaya0000000000000000',
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
    involvedIds: [],
    heldUntil: '2026-10-05T04:30:00.000Z',
    followUpAt: null,
    branchId: null,
    notes: null,
    lastActivityAt: '2026-10-02T04:30:00.000Z',
    isAwaitingReply: false,
    createdAt: '2026-09-30T04:30:00.000Z',
    updatedAt: '2026-10-02T04:30:00.000Z',
    ...overrides,
  };
}

const ANAYA = leadRecord();
const KABIR = leadRecord({
  id: 'lead_kabir0000000000000000',
  leadNumber: 2364,
  contactId: 'con_kabir0000000000000000',
  name: 'Kabir Mehta',
  ownerId: null,
});
const POONAM = leadRecord({
  id: 'lead_poonam000000000000000',
  leadNumber: 2362,
  contactId: 'con_poonam000000000000000',
  name: 'Poonam Balar',
  ownerId: RIYA,
});

/** What a create sends. */
const NEW_FIELDS: LeadFields = {
  status: 'new',
  source: 'walk_in',
  interests: ['peel'],
  ownerId: RIYA,
  involvedIds: [],
  followUpAt: null,
  branchId: null,
  notes: null,
};

/** The server the mocked api serves: its leads, a page size, a write held until let go. */
const server = {
  leads: [] as LeadRecord[],
  pageSize: 2,
  hold: null as Promise<void> | null,
  failList: false,
};

/** Hold the next writes until the returned function lets them land. */
function holdWrites(): () => void {
  let release: () => void = () => undefined;
  server.hold = new Promise((resolve) => {
    release = resolve;
  });
  return release;
}

/** The lead on the server with this id. */
function stored(id: string): LeadRecord {
  const lead = server.leads.find((candidate) => candidate.id === id);
  if (!lead) throw new Error(`no lead ${id}`);
  return lead;
}

/** Replace a lead on the server with its change applied. */
function patchStored(id: string, patch: Partial<LeadRecord>): LeadRecord {
  const saved = { ...stored(id), ...patch, updatedAt: '2026-10-03T04:30:00.000Z' };
  server.leads = server.leads.map((lead) => (lead.id === id ? saved : lead));
  return saved;
}

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The All list beside the write under test, sharing one cache. */
function renderWithList<T>(useWrite: () => T) {
  return renderHook(
    () => ({ list: useLeadList({ view: 'all', viewerId: RIYA }), write: useWrite() }),
    { wrapper },
  );
}

const namesOf = (rows: readonly LeadRecord[]) => rows.map((row) => row.name);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  signInTestMember();
  Object.assign(server, {
    leads: [ANAYA, KABIR, POONAM],
    pageSize: 2,
    hold: null,
    failList: false,
  });
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();

  vi.mocked(listLeads).mockImplementation(async (_params, after) => {
    if (server.failList) throw new Error('connection dropped');
    const start = after ? Number(after.replace('cursor-', '')) : 0;
    const end = start + server.pageSize;
    return {
      rows: server.leads.slice(start, end),
      next: end < server.leads.length ? `cursor-${end}` : null,
      total: server.leads.length,
    };
  });
  vi.mocked(fetchLead).mockImplementation(async (id) => stored(id));
  vi.mocked(countUnrepliedLeads).mockResolvedValue(3);
  vi.mocked(countOpenLeadTasks).mockResolvedValue(2);
  vi.mocked(createLead).mockImplementation(async ({ fields }) => {
    const created = leadRecord({
      ...fields,
      id: 'lead_hetal0000000000000000',
      leadNumber: 2386,
      name: 'Hetal Parmar',
    });
    server.leads = [created, ...server.leads];
    return created;
  });
  vi.mocked(updateLead).mockImplementation(async ({ leadId, fields }) =>
    patchStored(leadId, fields),
  );
  vi.mocked(claimLead).mockImplementation(async (leadId) => {
    const { ownerId, involvedIds } = stored(leadId);
    return patchStored(leadId, {
      ownerId: RIYA,
      involvedIds: ownerId ? [...involvedIds, ownerId] : involvedIds,
    });
  });
  vi.mocked(releaseLead).mockImplementation(async (leadId) =>
    patchStored(leadId, { heldUntil: null }),
  );
  vi.mocked(deleteLead).mockImplementation(async ({ leadId }) => {
    await server.hold;
    server.leads = server.leads.filter((lead) => lead.id !== leadId);
  });
  vi.mocked(restoreLead).mockImplementation(async () => {
    server.leads = [...server.leads, KABIR];
    return KABIR;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  useOrganizationStore.getState().clearOrganization();
  useAuthStore.setState({ user: null });
});

describe('useLeadList', () => {
  it('reads the list a cursor page at a time, for the params asked', async () => {
    const params = { view: 'mine', viewerId: RIYA } as const;
    const { result } = renderHook(() => useLeadList(params), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(namesOf(result.current.rows)).toEqual(['Anaya Desai', 'Kabir Mehta']);
    expect(result.current.hasNextPage).toBe(true);
    expect(listLeads).toHaveBeenLastCalledWith(params, undefined);

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(namesOf(result.current.rows).at(-1)).toBe('Poonam Balar');
    expect(result.current.hasNextPage).toBe(false);
    expect(listLeads).toHaveBeenLastCalledWith(params, 'cursor-2');
  });

  it('waits while told to — Mine reads nothing before the viewer is known', () => {
    const { result } = renderHook(
      () => useLeadList({ view: 'mine', viewerId: null }, { enabled: false }),
      { wrapper },
    );
    expect(result.current.isPending).toBe(true);
    expect(listLeads).not.toHaveBeenCalled();
  });

  it('reads nothing outside an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useLeadList({ view: 'all', viewerId: RIYA }), { wrapper });
    expect(listLeads).not.toHaveBeenCalled();
  });

  it('says once that the list failed, with Retry', async () => {
    server.failList = true;
    const { result } = renderHook(() => useLeadList({ view: 'all', viewerId: RIYA }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notify.error).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(notify.error).mock.lastCall ?? [];
    expect(message).toBe(
      'Couldn’t load this list · connection dropped. Showing the last copy.',
    );
    expect(options).toMatchObject({ id: 'list-error:leads', action: { label: 'Retry' } });

    server.failList = false;
    act(() => options?.action?.onClick?.());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
  });
});

describe('useLead', () => {
  it('reads one lead, and stays idle without an id', async () => {
    const { result } = renderHook(() => useLead(KABIR.id), { wrapper });
    await waitFor(() => expect(result.current.data?.name).toBe('Kabir Mehta'));
    expect(fetchLead).toHaveBeenCalledWith(KABIR.id);

    const idle = renderHook(() => useLead(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    expect(fetchLead).toHaveBeenCalledTimes(1);
  });
});

describe('useUnrepliedLeadCount', () => {
  it('counts the viewer’s leads awaiting a reply, and stays idle without a viewer', async () => {
    const { result } = renderHook(() => useUnrepliedLeadCount(RIYA), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(3));
    expect(countUnrepliedLeads).toHaveBeenCalledWith(RIYA);

    const idle = renderHook(() => useUnrepliedLeadCount(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    expect(countUnrepliedLeads).toHaveBeenCalledTimes(1);
  });
});

describe('useOpenLeadTasks', () => {
  it('counts a lead’s open tasks, and stays idle without an id', async () => {
    const { result } = renderHook(() => useOpenLeadTasks(ANAYA.id), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(countOpenLeadTasks).toHaveBeenCalledWith(ANAYA.id);

    const idle = renderHook(() => useOpenLeadTasks(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    expect(countOpenLeadTasks).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateLead', () => {
  it('creates with the action’s key, says "Lead #2386 created" and lists it first (D28)', async () => {
    const { result } = renderWithList(() => useCreateLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));

    await act(() =>
      result.current.write.mutateAsync({
        person: { contactId: 'con_hetal0000000000000000' },
        fields: NEW_FIELDS,
      }),
    );

    expect(createLead).toHaveBeenCalledWith({
      person: { contactId: 'con_hetal0000000000000000' },
      fields: NEW_FIELDS,
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenCalledWith('Lead #2386 created');
    await waitFor(() => expect(result.current.list.rows[0]?.leadNumber).toBe(2386));
  });

  it('says why a create was refused, and lists nothing new', async () => {
    vi.mocked(createLead).mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderHook(() => useCreateLead(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ person: { contactId: ANAYA.contactId }, fields: NEW_FIELDS })
        .catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.success).not.toHaveBeenCalled();
    expect(server.leads).toHaveLength(3);
  });
});

describe('useUpdateLead', () => {
  it('sends the read’s updatedAt and says "Lead saved" when the status stays', async () => {
    const { result } = renderHook(() => useUpdateLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        lead: ANAYA,
        fields: { interests: ['clinical', 'peel'] },
      }),
    );
    expect(updateLead).toHaveBeenCalledWith({
      leadId: ANAYA.id,
      fields: { interests: ['clinical', 'peel'] },
      expectedUpdatedAt: ANAYA.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenCalledWith('Lead saved');
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('names a status move — "<name> → <status>" — with no Undo', async () => {
    const { result } = renderHook(() => useUpdateLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ lead: ANAYA, fields: { status: 'follow_up' } }),
    );
    expect(notify.success).toHaveBeenCalledWith('Anaya Desai → Follow-up');
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('takes the caller’s message instead, and runs the caller’s onSuccess', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useUpdateLead({ successMessage: 'Changes saved', onSuccess }),
      { wrapper },
    );
    await act(() => result.current.mutateAsync({ lead: ANAYA, fields: { notes: 'Hi' } }));
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith('Changes saved');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('refreshes the lead’s own read once it lands', async () => {
    const { result } = renderHook(
      () => ({ lead: useLead(ANAYA.id), save: useUpdateLead() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.lead.data?.status).toBe('new'));
    await act(() =>
      result.current.save.mutateAsync({ lead: ANAYA, fields: { status: 'contacted' } }),
    );
    await waitFor(() => expect(result.current.lead.data?.status).toBe('contacted'));
  });
});

describe('useClaimLead', () => {
  it('claims with the action’s key: "You now own <name> · <owner> stays involved", no Undo', async () => {
    const { result } = renderHook(() => useClaimLead(), { wrapper });
    await act(() => result.current.mutateAsync({ lead: ANAYA, ownerName: 'Nidhi K.' }));
    expect(claimLead).toHaveBeenCalledWith(ANAYA.id, expect.any(String));
    expect(notify.success).toHaveBeenCalledWith(
      'You now own Anaya Desai · Nidhi K. stays involved',
    );
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('says only "You now own <name>" when nobody held it', async () => {
    const { result } = renderHook(() => useClaimLead(), { wrapper });
    await act(() => result.current.mutateAsync({ lead: KABIR, ownerName: null }));
    expect(notify.success).toHaveBeenCalledWith('You now own Kabir Mehta');
  });

  it('says the caller’s own words when it brings them', async () => {
    const { result } = renderHook(() => useClaimLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        lead: ANAYA,
        ownerName: 'Nidhi K.',
        message: 'Claimed by Riya Shah',
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Claimed by Riya Shah');
  });
});

describe('useAssignLead', () => {
  it('sets the owner without a stale check: "<name> is now assigned · notified", no Undo', async () => {
    const { result } = renderHook(() => useAssignLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ lead: ANAYA, ownerId: RIYA, ownerName: 'Riya S.' }),
    );
    expect(updateLead).toHaveBeenCalledWith({
      leadId: ANAYA.id,
      fields: { ownerId: RIYA },
      idempotencyKey: expect.any(String),
    });
    expect(stored(ANAYA.id).ownerId).toBe(RIYA);
    expect(notify.success).toHaveBeenCalledWith('Riya S. is now assigned · notified');
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('says the caller’s own words when it brings them', async () => {
    const { result } = renderHook(() => useAssignLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        lead: ANAYA,
        ownerId: RIYA,
        ownerName: 'Riya S.',
        message: 'Assigned to you',
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Assigned to you');
  });
});

describe('useReleaseLead', () => {
  it('releases with the action’s key: "Released to the team · anyone can claim", no Undo', async () => {
    const { result } = renderHook(() => useReleaseLead(), { wrapper });
    await act(() => result.current.mutateAsync(POONAM));
    expect(releaseLead).toHaveBeenCalledWith(POONAM.id, expect.any(String));
    expect(stored(POONAM.id).heldUntil).toBeNull();
    expect(notify.success).toHaveBeenCalledWith(
      'Released to the team · anyone can claim',
    );
    expect(notify.undo).not.toHaveBeenCalled();
  });
});

describe('useSetLeadInvolved', () => {
  it('applies the new list at once, with no stale check and no toast', async () => {
    const { result } = renderHook(() => useSetLeadInvolved(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ id: ANAYA.id, involvedIds: [RIYA, NIDHI] }),
    );
    expect(updateLead).toHaveBeenCalledWith({
      leadId: ANAYA.id,
      fields: { involvedIds: [RIYA, NIDHI] },
      idempotencyKey: expect.any(String),
    });
    expect(stored(ANAYA.id).involvedIds).toEqual([RIYA, NIDHI]);
    for (const toast of Object.values(notify)) expect(toast).not.toHaveBeenCalled();
  });
});

describe('useDeleteLead', () => {
  it('drops the row from the list at once, sends the reason, and raises no toast of its own', async () => {
    const { result } = renderWithList(() => useDeleteLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));
    const release = holdWrites();

    let landed: Promise<unknown> = Promise.resolve();
    act(() => {
      landed = result.current.write.mutateAsync({
        id: KABIR.id,
        reason: 'other',
        note: 'Spam number',
      });
    });
    await waitFor(() =>
      expect(namesOf(result.current.list.rows)).toEqual(['Anaya Desai']),
    );

    release();
    await act(() => landed);
    expect(deleteLead).toHaveBeenCalledWith({
      leadId: KABIR.id,
      reason: 'other',
      note: 'Spam number',
    });
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));
    expect(namesOf(result.current.list.rows)).not.toContain('Kabir Mehta');
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('puts the row back and says why when the delete fails', async () => {
    vi.mocked(deleteLead).mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderWithList(() => useDeleteLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));

    await act(async () => {
      await result.current.write
        .mutateAsync({ id: KABIR.id, reason: 'duplicate', note: null })
        .catch(() => undefined);
    });

    expect(namesOf(result.current.list.rows)).toEqual(['Anaya Desai', 'Kabir Mehta']);
    expect(notify.error).toHaveBeenCalledTimes(1);
  });

  it('leaves the lead’s own read alone — it would answer 404 while its drawer closes', async () => {
    const { result } = renderHook(
      () => ({ lead: useLead(KABIR.id), remove: useDeleteLead() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.lead.isSuccess).toBe(true));
    await act(() =>
      result.current.remove.mutateAsync({ id: KABIR.id, reason: 'mistake', note: null }),
    );
    const detail = leadQueryKeys.detail('org_test', KABIR.id);
    expect(client.getQueryState(detail)?.isInvalidated).toBe(false);
    expect(fetchLead).toHaveBeenCalledTimes(1);
  });
});

describe('useRestoreLead', () => {
  it('brings a removed lead back with the action’s key, silently', async () => {
    Object.assign(server, { leads: [ANAYA, POONAM], pageSize: 3 });
    const { result } = renderWithList(() => useRestoreLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));
    expect(namesOf(result.current.list.rows)).not.toContain('Kabir Mehta');

    await act(() => result.current.write.mutateAsync(KABIR.id));

    expect(restoreLead).toHaveBeenCalledWith(KABIR.id, expect.any(String));
    await waitFor(() =>
      expect(namesOf(result.current.list.rows)).toContain('Kabir Mehta'),
    );
    expect(notify.success).not.toHaveBeenCalled();
  });
});
