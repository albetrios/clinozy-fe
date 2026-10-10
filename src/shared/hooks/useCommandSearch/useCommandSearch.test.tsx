import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CommandSearchApiModule from '@/shared/api/clinic/command-search-api.ts';
import type { CommandSearchPerson } from '@/shared/api/clinic/command-search-contracts.ts';

import { useCommandSearch } from './useCommandSearch.ts';

/** A person the contacts search knows. */
const person = (name: string, contactNumber: number): CommandSearchPerson => ({
  id: `con_${name
    .toLowerCase()
    .replaceAll(/[^a-z]/g, '')
    .padEnd(21, '0')}`,
  name,
  contactNumber,
  phone: '+919825044120',
  patientId: null,
  patientNumber: null,
  openLeadId: null,
});

const PEOPLE = [
  person('Dharti Galani', 1),
  person('Drashtik Baldha', 2),
  person('Rhea Shah', 3),
];

const { searchSpy } = vi.hoisted(() => ({ searchSpy: vi.fn<(query: string) => void>() }));

// `GET /app/contacts?q=` as a name match; the minimum is the real module's.
vi.mock('@/shared/api/clinic/command-search-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof CommandSearchApiModule>();
  return {
    ...actual,
    searchClinicCommands: async (query: string) => {
      searchSpy(query);
      const q = query.trim().toLowerCase();
      return {
        people: PEOPLE.filter(({ name }) =>
          name
            .toLowerCase()
            .split(' ')
            .some((part) => part.startsWith(q)),
        ),
      };
    },
  };
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderSearch(initial: string, enabled = true) {
  return renderHook(({ query, on }) => useCommandSearch(query, { enabled: on }), {
    wrapper,
    initialProps: { query: initial, on: enabled },
  });
}

const names = (data: ReturnType<typeof useCommandSearch>['data']) =>
  data?.people.map((hit) => hit.name) ?? [];

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  searchSpy.mockClear();
});
afterEach(() => {
  client.clear();
});

describe('useCommandSearch', () => {
  it('waits out the debounce, then answers the query as typed', async () => {
    const { result, rerender } = renderSearch('');
    rerender({ query: 'dha', on: true });

    expect(result.current.isSearching).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(searchSpy).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(searchSpy).toHaveBeenCalledExactlyOnceWith('dha');
    expect(names(result.current.data)).toContain('Dharti Galani');
  });

  it('searches nothing the contacts search would refuse — two letters, three digits', async () => {
    for (const query of ['dh', '982']) {
      const { result, unmount } = renderSearch(query);
      expect(result.current).toEqual({ data: undefined, isSearching: false });
      unmount();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('searches a whole contact number however short', async () => {
    const { result } = renderSearch('C-12');
    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(searchSpy).toHaveBeenCalledExactlyOnceWith('C-12');
  });

  it('searches nothing while disabled (the member can open nobody)', async () => {
    const { result } = renderSearch('dha', false);

    expect(result.current).toEqual({ data: undefined, isSearching: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('keeps a related answer up while the next one loads', async () => {
    const { result, rerender } = renderSearch('dha');
    await waitFor(() => expect(result.current.isSearching).toBe(false));
    const first = names(result.current.data);

    rerender({ query: 'dhar', on: true });

    expect(result.current.isSearching).toBe(true);
    expect(names(result.current.data)).toEqual(first);
    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(searchSpy).toHaveBeenLastCalledWith('dhar');
  });

  it('never shows an unrelated answer for the new query', async () => {
    const { result, rerender } = renderSearch('rhe');
    await waitFor(() => expect(names(result.current.data)).toContain('Rhea Shah'));

    rerender({ query: 'dha', on: true });

    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(names(result.current.data)).toContain('Dharti Galani'));
  });

  it('drops the hits as soon as the query falls below the minimum', async () => {
    const { result, rerender } = renderSearch('dha');
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ query: 'dh', on: true });

    expect(result.current).toEqual({ data: undefined, isSearching: false });
  });
});
