import { describe, expect, it } from 'vitest';

import { isSettingsPathAllowed } from './settings-route-policy.ts';

describe('isSettingsPathAllowed', () => {
  it('blocks settings on onboarding and auth funnels', () => {
    expect(isSettingsPathAllowed('/onboarding')).toBe(false);
    expect(isSettingsPathAllowed('/login')).toBe(false);
    expect(isSettingsPathAllowed('/callback')).toBe(false);
    expect(isSettingsPathAllowed('/accept-invite/inv_abc')).toBe(false);
  });

  it('allows settings on app surfaces', () => {
    expect(isSettingsPathAllowed('/dashboard')).toBe(true);
    expect(isSettingsPathAllowed('/organization/acme/dashboard')).toBe(true);
    expect(isSettingsPathAllowed('/organization')).toBe(true);
  });
});
