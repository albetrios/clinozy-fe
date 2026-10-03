import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { runtimeMock } = vi.hoisted(() => ({
  runtimeMock: { show: vi.fn(), promise: vi.fn(), dismiss: vi.fn(), renderer: vi.fn() },
}));
vi.mock('./notify-runtime.tsx', () => runtimeMock);

import {
  notificationBridge,
  notify,
  TOAST_DURATION_MS,
  UNDO_TOAST_DURATION_MS,
} from './notify.ts';

let release: (() => void) | undefined;
async function activate() {
  await vi.waitFor(() => expect(notificationBridge.getSnapshot().runtime).toBeDefined());
  release = notificationBridge.activate();
}

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  notify.dismiss();
  release?.();
  release = undefined;
  vi.useRealTimers();
});

describe('notify', () => {
  it('retains each level and stable IDs while its renderer is not ready', async () => {
    const ids = [
      notify.success('ok'),
      notify.error('bad'),
      notify.info('fyi'),
      notify.warning('careful'),
      notify.loading('wait'),
    ];
    expect(new Set(ids).size).toBe(5);
    expect(runtimeMock.show).not.toHaveBeenCalled();
    expect(notificationBridge.getSnapshot().pending.map((item) => item.id)).toEqual(ids);
    await activate();
    expect(runtimeMock.show.mock.calls.map(([type]) => type)).toEqual([
      'success',
      'error',
      'info',
      'warning',
      'loading',
    ]);
    expect(runtimeMock.show.mock.calls[4]?.[2]).toMatchObject({ duration: Infinity });
    expect(notificationBridge.getSnapshot().pending).toEqual([]);
  });

  it('preserves options and replaces a queued toast with the same ID', async () => {
    vi.useFakeTimers();
    notify.loading('Saving', { id: 'save' });
    notify.success('Saved', { id: 'save', description: 'All set', duration: 1000 });
    const deadline = Date.now() + 1000;
    expect(notificationBridge.getSnapshot().pending).toHaveLength(1);
    await activate();
    expect(runtimeMock.show).toHaveBeenCalledExactlyOnceWith('success', 'Saved', {
      id: 'save',
      description: 'All set',
      duration: deadline - Date.now(),
    });
  });

  it('dismisses queued messages before the host mounts without resurrecting them', async () => {
    const id = notify.info('Dismiss me');
    notify.dismiss(id);
    await activate();
    expect(runtimeMock.show).not.toHaveBeenCalled();
    expect(runtimeMock.dismiss).toHaveBeenCalledWith(id);
  });

  it('publishes directly once the renderer is subscribed', async () => {
    notify.info('First');
    await activate();
    runtimeMock.show.mockClear();
    const id = notify.error('Next');
    expect(runtimeMock.show).toHaveBeenCalledExactlyOnceWith('error', 'Next', {
      id,
      duration: TOAST_DURATION_MS.error,
    });
    notify.dismiss(id);
    expect(runtimeMock.dismiss).toHaveBeenCalledWith(id);
  });

  it('keeps settled promise feedback without restarting its lifetime at handoff', async () => {
    const value = Promise.resolve(1);
    const messages = { loading: 'loading', success: 'success', error: 'error' };
    const handle = notify.promise(value, messages);
    expect(notificationBridge.getSnapshot().pending[0]?.message).toBe('loading');
    await expect(handle.unwrap()).resolves.toBe(1);
    expect(notificationBridge.getSnapshot().pending[0]?.message).toBe('success');
    await activate();
    expect(runtimeMock.show).toHaveBeenCalledExactlyOnceWith(
      'success',
      'success',
      expect.objectContaining({ id: handle.valueOf() }),
    );
    expect(runtimeMock.promise).not.toHaveBeenCalled();
  });

  it('retains rejection feedback and unwrap rejects without an unhandled transport promise', async () => {
    const error = new Error('Failed');
    const value = Promise.reject(error);
    const handle = notify.promise(value, {
      loading: 'Saving',
      success: 'Saved',
      error: 'Failed',
    });
    await expect(handle.unwrap()).rejects.toBe(error);
    expect(notificationBridge.getSnapshot().pending[0]).toMatchObject({
      type: 'error',
      message: 'Failed',
    });
    notify.dismiss(handle.valueOf());
    await activate();
    expect(runtimeMock.promise).not.toHaveBeenCalled();
  });

  it('expires finite messages even if the renderer never becomes active', () => {
    vi.useFakeTimers();
    notify.info('Default lifetime');
    notify.info('Short lifetime', { duration: 1000 });
    vi.advanceTimersByTime(1000);
    expect(notificationBridge.getSnapshot().pending.map((item) => item.message)).toEqual([
      'Default lifetime',
    ]);
    vi.advanceTimersByTime(TOAST_DURATION_MS.default - 1000);
    expect(notificationBridge.getSnapshot().pending).toEqual([]);
  });

  it('gives a toast that names no lifetime 5.2s, and a failure 9s', () => {
    vi.useFakeTimers();
    expect(TOAST_DURATION_MS).toEqual({ default: 5200, error: 9000 });
    notify.success('Saved');
    notify.error('Couldn’t save');
    expect(
      notificationBridge.getSnapshot().pending.map((item) => item.options.duration),
    ).toEqual([5200, 9000]);

    vi.advanceTimersByTime(5199);
    expect(notificationBridge.getSnapshot().pending).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(notificationBridge.getSnapshot().pending.map((item) => item.message)).toEqual([
      'Couldn’t save',
    ]);
    vi.advanceTimersByTime(3800);
    expect(notificationBridge.getSnapshot().pending).toEqual([]);
  });

  it('expires a queued message without calling into a renderer that never received it', async () => {
    vi.useFakeTimers();
    notify.info('Queued', { duration: 60_000 });
    // The renderer module loads but nothing activates it, as in a page test without
    // AppToaster mounted.
    await vi.waitFor(() =>
      expect(notificationBridge.getSnapshot().runtime).toBeDefined(),
    );
    vi.advanceTimersByTime(60_000);
    expect(notificationBridge.getSnapshot().pending).toEqual([]);
    expect(runtimeMock.dismiss).not.toHaveBeenCalled();
  });

  it('transfers only the remaining duration and does not expire replacements early', async () => {
    vi.useFakeTimers();
    notify.info('Old', { id: 'replace', duration: 1000 });
    vi.advanceTimersByTime(500);
    notify.info('New', { id: 'replace', duration: 2000 });
    const deadline = Date.now() + 2000;
    vi.advanceTimersByTime(1000);
    expect(notificationBridge.getSnapshot().pending[0]?.message).toBe('New');
    await activate();
    expect(runtimeMock.show).toHaveBeenCalledWith('info', 'New', {
      id: 'replace',
      duration: deadline - Date.now(),
    });
    runtimeMock.dismiss.mockClear();
    vi.advanceTimersByTime(5000);
    expect(runtimeMock.dismiss).not.toHaveBeenCalled();
  });

  it('undo: an "Undo" action that stays for the 10s restore window', async () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const id = notify.undo('Priya Shah removed', { id: 'remove-pt-1', onUndo });
    expect(UNDO_TOAST_DURATION_MS).toBe(10_000);
    const [pending] = notificationBridge.getSnapshot().pending;
    expect(pending).toMatchObject({
      id: 'remove-pt-1',
      type: 'success',
      message: 'Priya Shah removed',
      options: { duration: UNDO_TOAST_DURATION_MS, action: { label: 'Undo' } },
    });

    pending?.options.action?.onClick();
    expect(onUndo).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(UNDO_TOAST_DURATION_MS - 1);
    expect(notificationBridge.getSnapshot().pending.map((item) => item.id)).toEqual([id]);
    vi.advanceTimersByTime(1);
    expect(notificationBridge.getSnapshot().pending).toEqual([]);
  });

  it('undo: hands the renderer the action and what is left of the window', async () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    notify.undo('Lead removed', { id: 'remove-lead', onUndo });
    vi.advanceTimersByTime(4000);
    const deadline = Date.now() + UNDO_TOAST_DURATION_MS - 4000;
    await activate();
    expect(runtimeMock.show).toHaveBeenCalledExactlyOnceWith('success', 'Lead removed', {
      id: 'remove-lead',
      duration: deadline - Date.now(),
      action: { label: 'Undo', onClick: onUndo },
    });
  });

  it('keeps pending promises persistent and expires settled feedback', async () => {
    vi.useFakeTimers();
    let resolve!: (value: number) => void;
    const value = new Promise<number>((done) => {
      resolve = done;
    });
    notify.promise(value, { loading: 'Saving', success: 'Saved', error: 'Failed' });
    vi.advanceTimersByTime(10000);
    expect(notificationBridge.getSnapshot().pending[0]?.type).toBe('loading');
    resolve(1);
    await value;
    expect(notificationBridge.getSnapshot().pending[0]?.message).toBe('Saved');
    vi.advanceTimersByTime(TOAST_DURATION_MS.default);
    expect(notificationBridge.getSnapshot().pending).toEqual([]);
  });
});
