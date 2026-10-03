import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as UrlState from '@/shared/hooks/useDataTableUrlState/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ROOM_SEARCH_DEBOUNCE_MS, RoomSearch } from './RoomSearch.tsx';

// The real URL hook, with every patch it is asked for recorded as it happens.
const patches = vi.hoisted(() => [] as Readonly<Record<string, unknown>>[]);
vi.mock('@/shared/hooks/useDataTableUrlState/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof UrlState>();
  return {
    ...actual,
    useDataTableUrlState: (enabled: boolean) => {
      const state = actual.useDataTableUrlState(enabled);
      return {
        ...state,
        patchSearch: (patch: Readonly<Record<string, unknown>>) => {
          patches.push(patch);
          state.patchSearch(patch);
        },
      };
    },
  };
});

function renderSearch(initialEntries = ['/']) {
  return renderWithProviders(
    <>
      <RoomSearch
        placeholder="Name, mobile or #ID"
        label="Search patients"
        testIdPrefix="patients"
      />
      <input aria-label="Another field" />
      <div role="dialog" aria-label="Drawer">
        <button type="button">Inside the drawer</button>
      </div>
    </>,
    { initialEntries },
  );
}

const input = () => screen.getByRole('searchbox', { name: 'Search patients' });
const box = () => screen.getByTestId('patients-search');

beforeEach(() => {
  patches.length = 0;
});

describe('RoomSearch', () => {
  it('is a 36px square until "/" opens it, titled "Search · press /"', async () => {
    renderSearch();
    await screen.findByRole('searchbox');
    expect(box()).toHaveAttribute('data-expanded', 'false');
    expect(box()).toHaveAttribute('title', 'Search · press /');
    expect(box().className).toContain('md:max-w-9');

    fireEvent.keyDown(document.body, { key: '/' });
    expect(input()).toHaveFocus();
    expect(box()).toHaveAttribute('data-expanded', 'true');
    expect(box().className).not.toContain('md:max-w-9');
  });

  it('leaves "/" alone in a field, in an open overlay, or with a modifier', async () => {
    renderSearch();
    await screen.findByRole('searchbox');
    const other = screen.getByRole('textbox', { name: 'Another field' });
    other.focus();
    fireEvent.keyDown(other, { key: '/' });
    expect(other).toHaveFocus();

    const inDrawer = screen.getByRole('button', { name: 'Inside the drawer' });
    inDrawer.focus();
    fireEvent.keyDown(inDrawer, { key: '/' });
    expect(inDrawer).toHaveFocus();

    fireEvent.keyDown(document.body, { key: '/', metaKey: true });
    expect(input()).not.toHaveFocus();
  });

  describe('timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('patches q 300ms after the last key, not before, with the trimmed text', async () => {
      renderSearch();
      await act(() => vi.advanceTimersByTimeAsync(0));
      fireEvent.change(input(), { target: { value: 'as' } });
      act(() => vi.advanceTimersByTime(200));
      fireEvent.change(input(), { target: { value: 'asha ' } });

      act(() => vi.advanceTimersByTime(ROOM_SEARCH_DEBOUNCE_MS - 1));
      expect(patches).toEqual([]);
      act(() => vi.advanceTimersByTime(1));
      expect(patches).toEqual([{ q: 'asha' }]);
    });

    it('clears q at once', async () => {
      renderSearch(['/?q=asha']);
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(input()).toHaveValue('asha');

      fireEvent.change(input(), { target: { value: '' } });
      expect(patches).toEqual([{ q: undefined }]);
    });
  });

  it('writes the URL q, stays open while it holds text, and clears it', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch();
    await user.type(await screen.findByRole('searchbox'), 'asha');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'asha' }));

    await user.tab();
    expect(box()).toHaveAttribute('data-expanded', 'true');

    await user.clear(input());
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('shows a q changed elsewhere — Back, a shared link', async () => {
    const { router } = renderSearch();
    await screen.findByRole('searchbox');
    await act(() => router.navigate({ to: '/', search: { q: 'ravi' } as never }));
    expect(input()).toHaveValue('ravi');
    expect(box()).toHaveAttribute('data-expanded', 'true');
    expect(patches).toEqual([]);
  });

  it('blurs on Esc, folding back to its square when empty', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.click(await screen.findByRole('searchbox'));
    expect(box()).toHaveAttribute('data-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(input()).not.toHaveFocus();
    expect(box()).toHaveAttribute('data-expanded', 'false');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSearch();
    await screen.findByRole('searchbox');
    expect(await axe(container)).toHaveNoViolations();
  });
});
