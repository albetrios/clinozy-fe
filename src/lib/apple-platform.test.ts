import { afterEach, describe, expect, it, vi } from 'vitest';

import { isApplePlatform, platformShortcutKeys } from './apple-platform.ts';

describe('isApplePlatform', () => {
  it('reads Client Hints first, then the user agent', () => {
    expect(
      isApplePlatform({ userAgent: 'Windows', userAgentData: { platform: 'macOS' } }),
    ).toBe(true);
    expect(
      isApplePlatform({ userAgent: 'Macintosh', userAgentData: { platform: 'Windows' } }),
    ).toBe(false);
    expect(
      isApplePlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }),
    ).toBe(true);
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0)' })).toBe(true);
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe(false);
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe(false);
  });

  it('draws the Mac keys without a navigator', () => {
    expect(isApplePlatform(null)).toBe(true);
  });
});

describe('platformShortcutKeys', () => {
  const keys = {
    apple: { label: '⌘ ↵', aria: 'Meta+Enter' },
    other: { label: 'Ctrl ↵', aria: 'Control+Enter' },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands the ⌘ keys to an Apple device and the Ctrl keys to the rest', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' });
    expect(platformShortcutKeys(keys)).toBe(keys.apple);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' });
    expect(platformShortcutKeys(keys)).toBe(keys.other);
  });
});
