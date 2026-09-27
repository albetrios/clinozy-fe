import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelSensitiveClipboardClear,
  copySensitiveText,
  SENSITIVE_CLIPBOARD_CLEAR_MS,
} from './sensitive-clipboard.ts';

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
