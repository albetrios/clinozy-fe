import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useListLoadError } from './useListLoadError.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { error: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

beforeEach(() => notifyMock.error.mockReset());

describe('useListLoadError (KICKOFF §6.0 List error)', () => {
  it('toasts once per failure, for 9s, with a Retry that loads the list again', () => {
    const refetch = vi.fn();
    const { rerender } = renderHook(
      ({ isError }) => useListLoadError({ isError, refetch }, 'appointments'),
      { initialProps: { isError: false } },
    );
    expect(notifyMock.error).not.toHaveBeenCalled();

    rerender({ isError: true });
    rerender({ isError: true });
    expect(notifyMock.error).toHaveBeenCalledExactlyOnceWith(
      'Couldn’t load this list · connection dropped. Showing the last copy.',
      expect.objectContaining({
        id: 'list-error:appointments',
        duration: 9_000,
        action: expect.objectContaining({ label: 'Retry' }),
      }),
    );
    notifyMock.error.mock.calls[0]?.[1].action.onClick();
    expect(refetch).toHaveBeenCalledTimes(1);

    // Recovered, then failed again: a new toast.
    rerender({ isError: false });
    rerender({ isError: true });
    expect(notifyMock.error).toHaveBeenCalledTimes(2);
  });
});
