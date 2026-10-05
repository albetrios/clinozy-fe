import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as LeadsApiModule from '@/shared/api/clinic/leads-api.ts';
import { countOpenLeadTasks, fetchLead } from '@/shared/api/clinic/leads-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import {
  useAssignLead,
  useClaimLead,
  useCreateLead,
  useDeleteLead,
  useLead,
  useLeadContactSearch,
  useLeadList,
  useLeadViewer,
  useMarkLeadRead,
  useReleaseLead,
  useRestoreLead,
  useUnrepliedLeadCount,
  useUpdateLead,
} from './useLeads.ts';

/** Holds a write until a test lets it land, so the optimistic patch can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null, failList: false }));

vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof LeadsApiModule>();
  return {
    ...actual,
    deleteLead: async (...args: Parameters<typeof actual.deleteLead>) => {
      await gate.hold;
      return actual.deleteLead(...args);
    },
    listLeads: async (...args: Parameters<typeof actual.listLeads>) => {
      if (gate.failList) throw new Error('connection dropped');
      return actual.listLeads(...args);
    },
    markLeadRead: async (...args: Parameters<typeof actual.markLeadRead>) => {
      await gate.hold;
      return actual.markLeadRead(...args);
    },
  };
});
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

const RS = staffRef('RS');
const NK = staffRef('NK');
const AS = staffRef('AS');

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The whole pipeline beside the write under test, sharing one cache. */
function renderWith<T>(useWrite: () => T) {
  return renderHook(() => ({ list: useLeadList({ view: 'all' }), write: useWrite() }), {
    wrapper,
  });
}

const seqsOf = (rows: { seq: number }[]) => rows.map((row) => row.seq);

/** The Undo the last undo toast offers — what the toast's button runs. */
function lastUndo(): { message: string; onUndo: () => void } {
  const [message, options] = vi.mocked(notify.undo).mock.lastCall ?? [];
  if (!(message && options)) throw new Error('no undo toast');
  return { message, onUndo: options.onUndo };
}

beforeEach(() => {
  // Midday: past every seed's time today, so a new lead sorts first.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T06:30:00Z'));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  gate.hold = null;
  gate.failList = false;
  for (const fn of Object.values(notify)) vi.mocked(fn).mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('useLeadList', () => {
  it('reads the pipeline a cursor page at a time, for the view asked', async () => {
    const all = renderHook(() => useLeadList({ view: 'all' }), { wrapper });
    await waitFor(() => expect(all.result.current.isPending).toBe(false));
    expect(all.result.current.rows).toHaveLength(17);
    expect(all.result.current.hasNextPage).toBe(false);

    const mine = renderHook(() => useLeadList({ view: 'mine', viewerId: RS }), {
      wrapper,
    });
    await waitFor(() => expect(mine.result.current.isPending).toBe(false));
    expect(seqsOf(mine.result.current.rows)).toEqual([
      2363, 2365, 2356, 2355, 2354, 2353,
    ]);
  });

  it('waits while told to — "Mine" reads nothing before the viewer is known', () => {
    const { result } = renderHook(
      () => useLeadList({ view: 'mine', viewerId: null }, { enabled: false }),
      { wrapper },
    );
    expect(result.current.isPending).toBe(true);
    expect(client.isFetching()).toBe(0);
  });

  it('says once that the list failed, with Retry, and keeps the toast to one', async () => {
    gate.failList = true;
    const { result } = renderHook(() => useLeadList({ view: 'all' }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notify.error).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(notify.error).mock.lastCall ?? [];
    expect(message).toBe(
      'Couldn’t load this list · connection dropped. Showing the last copy.',
    );
    expect(options).toMatchObject({ id: 'list-error:leads', action: { label: 'Retry' } });
    gate.failList = false;
    act(() => options?.action?.onClick?.());
    await waitFor(() => expect(result.current.rows).toHaveLength(17));
  });
});

describe('useLeadViewer', () => {
  afterEach(() => useAuthStore.setState({ user: null }));

  it('reads the signed-in member by their email', async () => {
    useAuthStore.setState({
      user: { id: 'u', email: 'nidhi@cresence.skin', role: 'user' },
    });
    const { result } = renderHook(() => useLeadViewer(), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe(NK));
  });

  it('reads the fixture server’s own member before anyone is signed in', async () => {
    const { result } = renderHook(() => useLeadViewer(), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe(RS));
  });
});

describe('useLead', () => {
  it('reads one lead, and stays idle without an id', async () => {
    const { result } = renderHook(() => useLead(ref.lead(2364)), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Kabir Mehta');

    const idle = renderHook(() => useLead(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('useLeadContactSearch', () => {
  it('searches from two characters after the debounce, and says when nobody matches', async () => {
    const { result, rerender } = renderHook(({ query }) => useLeadContactSearch(query), {
      wrapper,
      initialProps: { query: 'd' },
    });
    expect(result.current).toEqual({ hits: [], noMatch: false });

    rerender({ query: 'Dharti' });
    await waitFor(() => expect(result.current.hits[0]?.name).toBe('Dharti Galani'));
    expect(result.current.noMatch).toBe(false);

    rerender({ query: 'zzqx' });
    await waitFor(() => expect(result.current.noMatch).toBe(true));
    expect(result.current.hits).toEqual([]);
  });
});

describe('useUnrepliedLeadCount', () => {
  it('counts the viewer’s unread leads, and stays idle without a viewer', async () => {
    const { result } = renderHook(() => useUnrepliedLeadCount(RS), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(2));
    const idle = renderHook(() => useUnrepliedLeadCount(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateLead', () => {
  it('creates, says "Lead #2386 created" and puts the new lead first (D28)', async () => {
    const { result } = renderWith(() => useCreateLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));

    await act(() =>
      result.current.write.mutateAsync({ name: 'Hetal Parmar', phone: '+919898012345' }),
    );

    expect(notify.success).toHaveBeenCalledWith('Lead #2386 created');
    await waitFor(() => expect(result.current.list.rows[0]?.seq).toBe(2386));
  });

  it('surfaces a refused create — the mobile is already a lead — and stores nothing', async () => {
    const { result } = renderHook(() => useCreateLead(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ name: 'Anaya D', phone: '+919879521034' })
        .catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledWith('This number is already a lead');
    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe('useUpdateLead', () => {
  it('says "Lead saved" when the status stays', async () => {
    const { result } = renderHook(() => useUpdateLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        id: ref.lead(2363),
        patch: { interests: ['clinical', 'peel'] },
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Lead saved');
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('names a status move with Undo, which takes the status and its task back', async () => {
    const { result } = renderHook(() => useUpdateLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ id: ref.lead(2363), patch: { status: 'follow_up' } }),
    );
    const undo = lastUndo();
    expect(undo.message).toBe('Anaya Desai → Follow-up · follow-up task for tomorrow');
    expect(notify.success).not.toHaveBeenCalled();
    expect(await countOpenLeadTasks(ref.lead(2363))).toBe(1);

    act(() => undo.onUndo());
    await waitFor(async () =>
      expect((await fetchLead(ref.lead(2363))).status).toBe('new'),
    );
    expect((await fetchLead(ref.lead(2363))).followUpAt).toBeNull();
    expect(await countOpenLeadTasks(ref.lead(2363))).toBe(0);
  });

  it('takes the caller’s message instead, and runs the caller’s onSuccess either way', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useUpdateLead({
          successMessage: 'Contact updated · applies everywhere',
          onSuccess,
        }),
      { wrapper },
    );
    await act(() =>
      result.current.mutateAsync({ id: ref.lead(2364), patch: { name: 'Kabir M' } }),
    );
    expect(notify.success).toHaveBeenCalledWith('Contact updated · applies everywhere');
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('useClaimLead', () => {
  it('claims from the row: "You now own …" with Undo, which puts the team back', async () => {
    const lead = await fetchLead(ref.lead(2362));
    const { result } = renderWith(() => useClaimLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));

    await act(() =>
      result.current.write.mutateAsync({ lead, viewerId: RS, ownerName: 'Asha M.' }),
    );
    const undo = lastUndo();
    expect(undo.message).toBe('You now own Poonam Balar · Asha M. stays involved');
    expect((await fetchLead(lead.id)).ownerId).toBe(RS);

    act(() => undo.onUndo());
    await waitFor(async () => expect((await fetchLead(lead.id)).ownerId).toBe(AS));
    expect((await fetchLead(lead.id)).involvedIds).toEqual([]);
  });

  it('says only "You now own …" when nobody held it', async () => {
    const lead: LeadRecord = await fetchLead(ref.lead(2361));
    const { result } = renderHook(() => useClaimLead(), { wrapper });
    await act(() => result.current.mutateAsync({ lead, viewerId: RS, ownerName: null }));
    expect(lastUndo().message).toBe('You now own Online Con');
  });
});

describe('useAssignLead', () => {
  it('assigns with "<name> is now assigned · notified" and Undo', async () => {
    const lead = await fetchLead(ref.lead(2357));
    const { result } = renderHook(() => useAssignLead(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ lead, ownerId: NK, ownerName: 'Nidhi K.' }),
    );
    const undo = lastUndo();
    expect(undo.message).toBe('Nidhi K. is now assigned · notified');
    expect((await fetchLead(lead.id)).ownerId).toBe(NK);

    act(() => undo.onUndo());
    await waitFor(async () =>
      expect((await fetchLead(lead.id)).ownerId).toBe(lead.ownerId),
    );
  });
});

describe('useReleaseLead', () => {
  it('releases with "Released to the team · anyone can claim" and Undo, which puts the team back', async () => {
    const lead = await fetchLead(ref.lead(2356));
    const { result } = renderHook(() => useReleaseLead(), { wrapper });
    await act(() => result.current.mutateAsync({ lead, viewerId: RS }));
    const undo = lastUndo();
    expect(undo.message).toBe('Released to the team · anyone can claim');
    expect(notify.success).not.toHaveBeenCalled();
    expect((await fetchLead(lead.id)).releasedAt).not.toBeNull();

    act(() => undo.onUndo());
    await waitFor(async () =>
      expect((await fetchLead(lead.id)).releasedAt).toBe(lead.releasedAt),
    );
    expect((await fetchLead(lead.id)).ownerId).toBe(lead.ownerId);
  });
});

describe('useMarkLeadRead', () => {
  it('drops the unread count at once, silently, and refreshes the Unreplied count', async () => {
    const { result } = renderHook(
      () => ({
        list: useLeadList({ view: 'all' }),
        count: useUnrepliedLeadCount(RS),
        read: useMarkLeadRead(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.count.data).toBe(2));
    let release: () => void = () => undefined;
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });

    let landed: Promise<unknown> = Promise.resolve();
    act(() => {
      landed = result.current.read.mutateAsync(ref.lead(2363));
    });
    await waitFor(() =>
      expect(result.current.list.rows.find((row) => row.seq === 2363)?.unreadCount).toBe(
        0,
      ),
    );

    release();
    await act(() => landed);
    await waitFor(() => expect(result.current.count.data).toBe(1));
    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe('useDeleteLead', () => {
  it('drops the row at once and raises no toast of its own', async () => {
    const { result } = renderWith(() => useDeleteLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));
    let release: () => void = () => undefined;
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });

    let landed: Promise<unknown> = Promise.resolve();
    act(() => {
      landed = result.current.write.mutateAsync({
        id: ref.lead(2357),
        reason: 'duplicate',
        note: null,
      });
    });
    await waitFor(() => expect(seqsOf(result.current.list.rows)).not.toContain(2357));

    release();
    await act(() => landed);
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));
    expect(seqsOf(result.current.list.rows)).not.toContain(2357);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('puts the row back and says why when the delete is refused', async () => {
    const { result } = renderWith(() => useDeleteLead());
    await waitFor(() => expect(result.current.list.isPending).toBe(false));

    await act(async () => {
      await result.current.write
        .mutateAsync({ id: ref.lead(2357), reason: 'other', note: null })
        .catch(() => undefined);
    });

    expect(seqsOf(result.current.list.rows)).toContain(2357);
    expect(notify.error).toHaveBeenCalledTimes(1);
  });
});

describe('useRestoreLead', () => {
  it('brings a removed lead back into the list, silently', async () => {
    const { result } = renderHook(
      () => ({
        list: useLeadList({ view: 'all' }),
        remove: useDeleteLead(),
        restore: useRestoreLead(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isPending).toBe(false));
    await act(() =>
      result.current.remove.mutateAsync({
        id: ref.lead(2357),
        reason: 'mistake',
        note: null,
      }),
    );
    await waitFor(() => expect(seqsOf(result.current.list.rows)).not.toContain(2357));

    await act(() => result.current.restore.mutateAsync(ref.lead(2357)));

    await waitFor(() => expect(seqsOf(result.current.list.rows)).toContain(2357));
    expect(notify.success).not.toHaveBeenCalled();
  });
});
