import { describe, expect, it, vi } from 'vitest';

const disabledModulesRef = vi.hoisted(() => ({ value: new Set<string>() }));
vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    get disabledModules() {
      return disabledModulesRef.value;
    },
  },
}));

import type { SettingsResolveContext } from './settings-resolve.ts';
import {
  isSettingsSectionAvailable,
  resolveSettingsSection,
} from './settings-resolve.ts';

const fallback = { scope: 'account', section: 'profile' } as const;

const baseCtx = (
  overrides: Partial<SettingsResolveContext> = {},
): SettingsResolveContext => ({
  hasOrganizationContext: true,
  orgType: 'TEAM',
  teamOrganizations: true,
  role: 'user',
  permissions: ['organization:read', 'membership:read', 'role:read', 'webhook:read'],
  ...overrides,
});

describe('isSettingsSectionAvailable', () => {
  beforeEach(() => {
    disabledModulesRef.value = new Set();
  });

  it('allows account sections for any signed-in user', () => {
    expect(
      isSettingsSectionAvailable(
        { scope: 'account', section: 'profile' },
        baseCtx({ permissions: [] }),
      ),
    ).toBe(true);
  });

  it('requires organization:read for account billing', () => {
    expect(
      isSettingsSectionAvailable(
        { scope: 'account', section: 'billing' },
        baseCtx({ permissions: [] }),
      ),
    ).toBe(false);
  });

  it('blocks organization sections without org context', () => {
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'general' },
        baseCtx({ hasOrganizationContext: false }),
      ),
    ).toBe(false);
  });

  it('blocks all organization sections for a personal workspace', () => {
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'general' },
        baseCtx({ orgType: 'PERSONAL' }),
      ),
    ).toBe(false);
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'members' },
        baseCtx({ orgType: 'PERSONAL' }),
      ),
    ).toBe(false);
  });

  it('blocks organization sections when team orgs are disabled for the deployment', () => {
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'general' },
        baseCtx({ teamOrganizations: false, orgType: undefined }),
      ),
    ).toBe(false);
  });

  it('allows team organization sections when permitted', () => {
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'members' },
        baseCtx({ orgType: 'TEAM' }),
      ),
    ).toBe(true);
  });

  it('blocks sections when the deployment disables their L6b module', () => {
    disabledModulesRef.value = new Set(['members']);
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'members' },
        baseCtx({ orgType: 'TEAM' }),
      ),
    ).toBe(false);
  });
});

describe('resolveSettingsSection', () => {
  it('returns the requested section when available', () => {
    expect(
      resolveSettingsSection(
        { scope: 'account', section: 'security' },
        baseCtx(),
        fallback,
      ),
    ).toEqual({ scope: 'account', section: 'security' });
  });

  it('falls back for unavailable organization deep links', () => {
    expect(
      resolveSettingsSection(
        { scope: 'organization', section: 'members' },
        baseCtx({ orgType: 'PERSONAL' }),
        fallback,
      ),
    ).toEqual(fallback);
  });
});
