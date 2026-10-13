import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelSensitiveClipboardClear,
  copySensitiveText,
  copyText,
  SENSITIVE_CLIPBOARD_CLEAR_MS,
} from './sensitive-clipboard.ts';

describe('copyText', () => {
  afterEach(() => {
    cancelSensitiveClipboardClear();
    vi.useRealTimers();
  });

  it('writes the text and leaves it on the clipboard', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    expect(await copyText('PT-1042')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('PT-1042');

    vi.advanceTimersByTime(10 * SENSITIVE_CLIPBOARD_CLEAR_MS);
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('returns false when the clipboard refuses the write', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    expect(await copyText('PT-1042')).toBe(false);
  });

  it('returns false when there is no clipboard', async () => {
    const original = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    expect(await copyText('PT-1042')).toBe(false);

    Object.defineProperty(navigator, 'clipboard', {
      value: original,
      configurable: true,
    });
  });
});

describe('copySensitiveText', () => {
  afterEach(() => {
    cancelSensitiveClipboardClear();
    vi.useRealTimers();
  });

  it('writes text and schedules a clipboard wipe', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const ok = await copySensitiveText('secret-code', { clearAfterMs: 1000 });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('secret-code');

    vi.advanceTimersByTime(1000);
    expect(writeText).toHaveBeenCalledWith('');
  });

  it('returns false when clipboard is unavailable', async () => {
    const original = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    expect(await copySensitiveText('x')).toBe(false);

    Object.defineProperty(navigator, 'clipboard', {
      value: original,
      configurable: true,
    });
  });

  it('exports a one-minute default clear interval', () => {
    expect(SENSITIVE_CLIPBOARD_CLEAR_MS).toBe(60_000);
  });
});
