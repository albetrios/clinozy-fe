import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CommandSearchApiModule from '@/shared/api/clinic/command-search-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { useCommandSearch } from './useCommandSearch.ts';

const { searchSpy } = vi.hoisted(() => ({ searchSpy: vi.fn<(query: string) => void>() }));

vi.mock('@/shared/api/clinic/command-search-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof CommandSearchApiModule>();
  return {
    ...actual,
    searchClinicCommands: (query: string) => {
      searchSpy(query);
      return actual.searchClinicCommands(query);
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

const patientNames = (data: ReturnType<typeof useCommandSearch>['data']) =>
  data?.patients.map((hit) => hit.name) ?? [];

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  searchSpy.mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
});

describe('useCommandSearch', () => {
  it('waits out the debounce, then answers the query as typed', async () => {
    const { result, rerender } = renderSearch('');
    rerender({ query: 'dh', on: true });

    expect(result.current.isSearching).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(searchSpy).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(searchSpy).toHaveBeenCalledExactlyOnceWith('dh');
    expect(patientNames(result.current.data)).toContain('Dharti Galani');
  });

  it('searches nothing below two characters', async () => {
    const { result } = renderSearch('d');

    expect(result.current).toEqual({ data: undefined, isSearching: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('searches nothing while disabled (no group the member may see)', async () => {
    const { result } = renderSearch('dh', false);

    expect(result.current).toEqual({ data: undefined, isSearching: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('keeps a related answer up while the next one loads', async () => {
    const { result, rerender } = renderSearch('dh');
    await waitFor(() => expect(result.current.isSearching).toBe(false));

    rerender({ query: 'dhar', on: true });

    expect(result.current.isSearching).toBe(true);
    expect(patientNames(result.current.data)).toContain('Drashtik Baldha');
    await waitFor(() =>
      expect(patientNames(result.current.data)).toEqual(['Dharti Galani']),
    );
  });

  it('never shows an unrelated answer for the new query', async () => {
    const { result, rerender } = renderSearch('rh');
    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(patientNames(result.current.data)).toContain('Rhea Shah');

    rerender({ query: 'dh', on: true });

    expect(result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(patientNames(result.current.data)).toContain('Dharti Galani'),
    );
  });

  it('drops the hits as soon as the query falls below two characters', async () => {
    const { result, rerender } = renderSearch('dh');
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ query: 'd', on: true });

    expect(result.current).toEqual({ data: undefined, isSearching: false });
  });
});
