import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ContactsApiModule from '@/shared/api/clinic/contacts-api.ts';
import {
  fetchContact,
  searchContacts,
  updateContact,
} from '@/shared/api/clinic/contacts-api.ts';
import type { Contact, ContactFields } from '@/shared/api/clinic/contacts-contracts.ts';
import { leadQueryKeys } from '@/shared/api/clinic/leads-api.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { useContact, useContactSearch, useUpdateContact } from './useContacts.ts';

vi.mock('@/shared/api/clinic/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ContactsApiModule>()),
  fetchContact: vi.fn(),
  searchContacts: vi.fn(),
  updateContact: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

/** Anaya Desai, as `GET /app/contacts/:contact_id` reads her. */
const ANAYA: Contact = {
  id: 'con_anaya0000000000000000',
  contactNumber: 10234,
  firstName: 'Anaya',
  lastName: 'Desai',
  name: 'Anaya Desai',
  primaryPhone: '+919879521034',
  email: null,
  instagramHandles: [],
  defaultChannel: 'whatsapp',
  preferenceTags: [],
  patientId: null,
  openLeadId: 'lead_anaya0000000000000000',
  lastActivityAt: '2026-10-02T04:30:00.000Z',
  lastReceivedAt: null,
  isAwaitingReply: false,
  updatedAt: '2026-10-02T04:30:00.000Z',
  phones: [{ phone: '+919879521034', isPrimary: true, isOnWhatsapp: true }],
};

/** The editor's fields for her, renamed. */
const EDITED: ContactFields = {
  firstName: 'Anaya',
  lastName: 'Desai Kapoor',
  phones: [{ phone: '+919879521034', isOnWhatsapp: true }],
  instagramHandles: ['anaya.dk'],
  defaultChannel: 'instagram',
  preferenceTags: ['evenings'],
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Let more than the search's 250ms debounce pass. */
const pastDebounce = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  signInTestMember();
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  vi.mocked(fetchContact).mockResolvedValue(ANAYA);
  vi.mocked(searchContacts).mockImplementation(async (typed) =>
    'anaya desai 9879521034'.includes(typed.toLowerCase().replaceAll(' ', ''))
      ? [ANAYA]
      : [],
  );
  vi.mocked(updateContact).mockImplementation(async ({ fields }) => ({
    ...ANAYA,
    lastName: fields.lastName,
    name: `${fields.firstName} ${fields.lastName}`,
    updatedAt: '2026-10-03T04:30:00.000Z',
  }));
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.resetAllMocks();
  useOrganizationStore.getState().clearOrganization();
  useAuthStore.setState({ user: null });
});

describe('useContact', () => {
  it('reads one person with every number, and stays idle without an id', async () => {
    const { result } = renderHook(() => useContact(ANAYA.id), { wrapper });
    await waitFor(() => expect(result.current.data?.phones).toHaveLength(1));
    expect(fetchContact).toHaveBeenCalledWith(ANAYA.id);

    const idle = renderHook(() => useContact(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    expect(fetchContact).toHaveBeenCalledTimes(1);
  });
});

describe('useContactSearch', () => {
  it('asks nothing under 3 letters or 4 digits', async () => {
    const { result } = renderHook(() => useContactSearch(' an '), { wrapper });
    await pastDebounce();
    expect(result.current).toEqual({ hits: [], noMatch: false });
    expect(searchContacts).not.toHaveBeenCalled();
  });

  it('asks once typing pauses, for what was typed last', async () => {
    const { result, rerender } = renderHook(({ query }) => useContactSearch(query), {
      wrapper,
      initialProps: { query: '' },
    });
    rerender({ query: 'ana' });
    rerender({ query: 'anay' });
    rerender({ query: ' anaya ' });
    expect(searchContacts).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.hits).toEqual([ANAYA]));
    expect(searchContacts).toHaveBeenCalledTimes(1);
    expect(searchContacts).toHaveBeenCalledWith('anaya');
    expect(result.current.noMatch).toBe(false);
  });

  it('searches from 4 digits of a number', async () => {
    const { result } = renderHook(() => useContactSearch('9879'), { wrapper });
    await waitFor(() => expect(result.current.hits).toEqual([ANAYA]));
    expect(searchContacts).toHaveBeenCalledWith('9879');
  });

  it('keeps the last answer up while the next loads, then says nobody matches', async () => {
    const { result, rerender } = renderHook(({ query }) => useContactSearch(query), {
      wrapper,
      initialProps: { query: 'anaya' },
    });
    await waitFor(() => expect(result.current.hits).toEqual([ANAYA]));

    rerender({ query: 'zzqx' });
    expect(result.current).toEqual({ hits: [ANAYA], noMatch: false });

    await waitFor(() => expect(result.current.noMatch).toBe(true));
    expect(result.current.hits).toEqual([]);
  });

  it('clears the hits at once when the query drops under the threshold', async () => {
    const { result, rerender } = renderHook(({ query }) => useContactSearch(query), {
      wrapper,
      initialProps: { query: 'anaya' },
    });
    await waitFor(() => expect(result.current.hits).toEqual([ANAYA]));
    rerender({ query: 'an' });
    expect(result.current).toEqual({ hits: [], noMatch: false });
  });
});

describe('useUpdateContact', () => {
  it('saves with the read’s updatedAt and the action’s key, silently', async () => {
    const { result } = renderHook(() => useUpdateContact(), { wrapper });
    const saved = await act(() =>
      result.current.mutateAsync({ contact: ANAYA, fields: EDITED }),
    );
    expect(updateContact).toHaveBeenCalledWith({
      contactId: ANAYA.id,
      fields: EDITED,
      expectedUpdatedAt: ANAYA.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(saved.name).toBe('Anaya Desai Kapoor');
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('refreshes the person and the leads that show them', async () => {
    const { result } = renderHook(
      () => ({ contact: useContact(ANAYA.id), save: useUpdateContact() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.contact.isSuccess).toBe(true));
    const leads = leadQueryKeys.lists('org_test');
    client.setQueryData(leads, { pages: [], pageParams: [] });

    await act(() => result.current.save.mutateAsync({ contact: ANAYA, fields: EDITED }));

    await waitFor(() => expect(fetchContact).toHaveBeenCalledTimes(2));
    expect(client.getQueryState(leads)?.isInvalidated).toBe(true);
  });

  it('takes the caller’s message and says why a save was refused', async () => {
    const { result } = renderHook(
      () => useUpdateContact({ successMessage: 'Contact updated · applies everywhere' }),
      { wrapper },
    );
    await act(() => result.current.mutateAsync({ contact: ANAYA, fields: EDITED }));
    expect(notify.success).toHaveBeenCalledWith('Contact updated · applies everywhere');

    vi.mocked(updateContact).mockRejectedValueOnce(new Error('connection dropped'));
    await act(async () => {
      await result.current
        .mutateAsync({ contact: ANAYA, fields: { ...EDITED, lastName: null } })
        .catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledTimes(1);
  });
});
