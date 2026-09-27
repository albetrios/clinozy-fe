import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The hook reads the token through the router's search (works under memory
// history in tests) and strips window.location — mock only the read side.
let mockSearch: Record<string, unknown> = {};
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => mockSearch,
}));

import { useConsumedSearchToken } from './useConsumedSearchToken.ts';

describe('useConsumedSearchToken', () => {
  beforeEach(() => {
    mockSearch = {};
    window.history.replaceState(null, '', '/accept-invite/inv_test');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('returns the token and strips it from the address bar', async () => {
    mockSearch = { token: 'sec-123' };
    window.history.replaceState(
      { key: 'k1' },
      '',
      '/accept-invite/inv_test?token=sec-123&x=1',
    );

    const { result } = renderHook(() => useConsumedSearchToken());

    expect(result.current).toBe('sec-123');
    await waitFor(() => {
      expect(window.location.search).toBe('?x=1');
    });
    // Router state object survives the replaceState.
    expect(window.history.state).toEqual({ key: 'k1' });
  });

  it('returns "" and leaves the URL alone when there is no token', () => {
    window.history.replaceState(null, '', '/accept-invite/inv_test?x=1');

    const { result } = renderHook(() => useConsumedSearchToken());

    expect(result.current).toBe('');
    expect(window.location.search).toBe('?x=1');
  });

  it('keeps returning the consumed token after the URL was scrubbed', async () => {
    mockSearch = { token: 'sec-456' };
    window.history.replaceState(null, '', '/accept-invite/inv_test?token=sec-456');

    const { result, rerender } = renderHook(() => useConsumedSearchToken());
    await waitFor(() => expect(window.location.search).toBe(''));

    mockSearch = {}; // router search no longer carries it
    rerender();

    expect(result.current).toBe('sec-456');
  });

  it('supports a custom param name', async () => {
    mockSearch = { invite: 'inv-1' };
    window.history.replaceState(null, '', '/accept?invite=inv-1');

    const { result } = renderHook(() => useConsumedSearchToken('invite'));

    expect(result.current).toBe('inv-1');
    await waitFor(() => expect(window.location.search).toBe(''));
  });
});
