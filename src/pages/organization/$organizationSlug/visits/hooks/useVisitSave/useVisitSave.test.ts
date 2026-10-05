import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicHttpError } from '@/shared/api/clinic/clinic-fixture-store.ts';
import { notify } from '@/shared/notify/index.ts';

import { useVisitSave } from './useVisitSave.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => vi.mocked(notify.error).mockClear());

describe('useVisitSave (KICKOFF §6.13 States)', () => {
  it('reads "Saving…" while a write runs and hands its answer on', async () => {
    const { result } = renderHook(() => useVisitSave());
    let release: (value: string) => void = () => {};
    const write = () =>
      new Promise<string>((resolve) => {
        release = resolve;
      });
    const onDone = vi.fn();
    let run: Promise<void> = Promise.resolve();
    act(() => {
      run = result.current.run(write, onDone);
    });
    expect(result.current.state).toBe('saving');
    await act(async () => {
      release('saved');
      await run;
    });
    expect(result.current.state).toBe('idle');
    expect(onDone).toHaveBeenCalledWith('saved');
  });

  it('toasts a refusal in the server’s words and stays as it was', async () => {
    const { result } = renderHook(() => useVisitSave());
    const onDone = vi.fn();
    await act(() =>
      result.current.run(
        () =>
          Promise.reject(
            clinicHttpError(409, 'already_billed', 'This visit is already billed'),
          ),
        onDone,
      ),
    );
    expect(result.current.state).toBe('idle');
    expect(onDone).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledTimes(1);
  });

  it('keeps the changes on a dropped connection, with a Retry that runs the write again', async () => {
    const { result } = renderHook(() => useVisitSave());
    const write = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('saved');
    const onDone = vi.fn();
    await act(() => result.current.run(write, onDone));
    expect(result.current.state).toBe('failed');
    expect(notify.error).toHaveBeenCalledWith(
      'Couldn’t save · connection dropped. Everything you entered is still here.',
      expect.objectContaining({ id: 'visit-save-failed' }),
    );
    const [, options] = vi.mocked(notify.error).mock.calls[0] ?? [];
    await act(async () => {
      options?.action?.onClick();
      await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('saved'));
    });
    expect(result.current.state).toBe('idle');
    expect(write).toHaveBeenCalledTimes(2);
  });
});
