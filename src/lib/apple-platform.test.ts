import { describe, expect, it } from 'vitest';

import { isApplePlatform } from './apple-platform.ts';

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
