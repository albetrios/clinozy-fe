import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ActivitiesApiModule from '@/shared/api/app/contact-activities-api.ts';
import {
  type ContactActivityEntry,
  type ContactActivityPage,
  listContactActivities,
  sendContactActivity,
} from '@/shared/api/app/contact-activities-api.ts';
import type { ChatMessage } from '@/shared/api/app/messages-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { TEST_CONTACT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  CONTACT_NOTES_FILTER,
  useAddContactNote,
  useContactActivities,
  useContactActivityAccess,
} from './useContactActivities.ts';

vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ActivitiesApiModule>()),
  listContactActivities: vi.fn(),
  sendContactActivity: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

/** The access in force: the codes of the member, or of the role a View-as preview shows. */
const access = vi.hoisted(() => ({
  isResolved: true,
  previewRole: null as string | null,
  codes: new Set<string>(),
}));
vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: () => ({
    previewRole: access.previewRole,
    isResolved: access.isResolved,
    can: () => false,
    canCode: (code: string) => access.codes.has(code),
    viewableSections: [],
  }),
}));

/** A team note of Priya's. */
const note = (id: string, body: string, at = '2026-10-03T04:00:00.000Z') =>
  ({
    id,
    type: 'note',
    group: 'messages',
    body,
    occurredAt: at,
    authorId: 'mem_riya00000000000000000',
    link: null,
  }) satisfies ContactActivityEntry;

const page = (
  rows: ContactActivityEntry[],
  more: Partial<ContactActivityPage> = {},
): ContactActivityPage => ({
  rows,
  next: null,
  hasMore: false,
  total: rows.length,
  ...more,
});

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  access.isResolved = true;
  access.previewRole = null;
  access.codes = new Set();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('useContactActivities', () => {
  it('reads a filter a page at a time, newest first, with the server’s total, and Load more', async () => {
    vi.mocked(listContactActivities)
      .mockResolvedValueOnce(
        page([note('msg_b', 'Second')], { next: 'cursor-2', hasMore: true, total: 2 }),
      )
      .mockResolvedValueOnce(page([note('msg_a', 'First')], { total: null }));
    const { wrapper: Wrapper } = wrapper();
    const { result } = renderHook(
      () => useContactActivities(TEST_CONTACT_ID, CONTACT_NOTES_FILTER, { limit: 1 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listContactActivities).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      filter: { type: ['note'] },
      limit: 1,
      after: undefined,
    });
    expect(result.current.entries.map((entry) => entry.body)).toEqual(['Second']);
    expect(result.current.total).toBe(2);
    expect(result.current.hasNextPage).toBe(true);

    act(() => result.current.fetchNextPage());
    act(() => result.current.fetchNextPage());
    await waitFor(() =>
      expect(result.current.entries.map((entry) => entry.body)).toEqual([
        'Second',
        'First',
      ]),
    );
    expect(listContactActivities).toHaveBeenCalledTimes(2);
    expect(listContactActivities).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'cursor-2' }),
    );
    expect(result.current.hasNextPage).toBe(false);
    // The first page's total stands.
    expect(result.current.total).toBe(2);
  });

  it('asks nothing without a contact, an organization, or when it may not read', async () => {
    const { wrapper: Wrapper } = wrapper();
    renderHook(() => useContactActivities(undefined, {}, { limit: 3 }), {
      wrapper: Wrapper,
    });
    renderHook(
      () => useContactActivities(TEST_CONTACT_ID, {}, { limit: 3, enabled: false }),
      { wrapper: Wrapper },
    );
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useContactActivities(TEST_CONTACT_ID, {}, { limit: 3 }), {
      wrapper: Wrapper,
    });
    await act(async () => undefined);
    expect(listContactActivities).not.toHaveBeenCalled();
  });

  it('says it failed in place — the screen offers Retry', async () => {
    vi.mocked(listContactActivities)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([note('msg_a', 'Back')]));
    const { wrapper: Wrapper } = wrapper();
    const { result } = renderHook(
      () => useContactActivities(TEST_CONTACT_ID, {}, { limit: 3 }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
  });
});

describe('useAddContactNote (§6 #3)', () => {
  const sent: ChatMessage = {
    id: 'msg_new',
    channel: 'note',
    direction: 'sent',
    body: 'Call before the next session',
    deliveryStatus: 'sent',
    isSystem: false,
    authorId: 'mem_riya00000000000000000',
    taskId: null,
    sentAt: '2026-10-03T05:00:00.000Z',
  };

  function renderNotes() {
    const view = wrapper();
    const notes = renderHook(
      () => ({
        list: useContactActivities(TEST_CONTACT_ID, CONTACT_NOTES_FILTER, { limit: 3 }),
        add: useAddContactNote(TEST_CONTACT_ID),
      }),
      { wrapper: view.wrapper },
    );
    return { ...view, ...notes };
  }

  it('posts an add-note with its key, the note topping the list at once, then reads it again', async () => {
    let answer: ((message: ChatMessage) => void) | undefined;
    vi.mocked(sendContactActivity).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    vi.mocked(listContactActivities)
      .mockResolvedValueOnce(page([note('msg_old', 'Earlier')]))
      .mockResolvedValueOnce(
        page([
          note('msg_new', 'Call before the next session'),
          note('msg_old', 'Earlier'),
        ]),
      );
    const { result, client } = renderNotes();
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    act(() => result.current.add.mutate({ body: 'Call before the next session' }));
    await waitFor(() =>
      expect(result.current.list.entries.map((entry) => entry.body)).toEqual([
        'Call before the next session',
        'Earlier',
      ]),
    );
    const [draft] = result.current.list.entries;
    // A note on its way stands for the signed-in member (`useStaffLookup` reads '').
    expect(draft).toMatchObject({ type: 'note', authorId: '' });
    expect(sendContactActivity).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      channel: 'note',
      body: 'Call before the next session',
      idempotencyKey: expect.any(String),
    });

    await act(async () => answer?.(sent));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['app', 'messages'] });
    await waitFor(() =>
      expect(result.current.list.entries.map((entry) => entry.id)).toEqual([
        'msg_new',
        'msg_old',
      ]),
    );
  });

  it('takes a refused note off the list again', async () => {
    vi.mocked(sendContactActivity).mockRejectedValueOnce(new Error('body too long'));
    vi.mocked(listContactActivities).mockResolvedValue(
      page([note('msg_old', 'Earlier')]),
    );
    const { result } = renderNotes();
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.add.mutateAsync({ body: 'Too long' }).catch(() => undefined);
    });
    expect(result.current.list.entries.map((entry) => entry.body)).toEqual(['Earlier']);
  });
});

describe('useContactActivityAccess', () => {
  it('follows the member’s own codes', () => {
    access.codes = new Set(['contact_activity:read']);
    const { result, rerender } = renderHook(() => useContactActivityAccess());
    expect(result.current).toEqual({ reads: true, writes: false });
    access.codes = new Set(['contact_activity:read', 'contact_activity:create']);
    rerender();
    expect(result.current).toEqual({ reads: true, writes: true });
  });

  it('previews a role by that role’s own codes', () => {
    access.previewRole = 'rol_therapist';
    access.codes = new Set(['contact_activity:read']);
    const { result } = renderHook(() => useContactActivityAccess());
    expect(result.current).toEqual({ reads: true, writes: false });
  });

  it('allows nothing until the access has answered', () => {
    access.isResolved = false;
    access.codes = new Set(['contact_activity:read', 'contact_activity:create']);
    const { result } = renderHook(() => useContactActivityAccess());
    expect(result.current).toEqual({ reads: false, writes: false });
  });
});
