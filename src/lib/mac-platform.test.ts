import { afterEach, describe, expect, it, vi } from 'vitest';

import { commandKeyLabel, isMacPlatform } from './mac-platform.ts';

describe('isMacPlatform', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the platform from userAgentData, else the user agent', () => {
    vi.stubGlobal('navigator', { userAgentData: { platform: 'macOS' }, userAgent: '' });
    expect(isMacPlatform()).toBe(true);
    expect(commandKeyLabel()).toBe('⌘');
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    expect(isMacPlatform()).toBe(false);
    expect(commandKeyLabel()).toBe('Ctrl');
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' });
    expect(isMacPlatform()).toBe(true);
  });
});
