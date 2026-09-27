/**
 * Settings hash access matrix (FE-52 extension). Proves L6b module gating on
 * settings sections mirrors route gateway behavior — disabled modules must not
 * open via `#settings/…` deep links even when RBAC would allow them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const disabledModulesRef = vi.hoisted(() => ({ value: new Set<string>() }));
vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    get disabledModules() {
      return disabledModulesRef.value;
    },
  },
}));

import { canViewSettingsSection } from '@/shared/components/SettingsModal/settings-permissions.ts';
import {
  isSettingsSectionAvailable,
  type SettingsResolveContext,
} from '@/shared/components/SettingsModal/settings-resolve.ts';

const teamAdminCtx: SettingsResolveContext = {
  hasOrganizationContext: true,
  orgType: 'TEAM',
  teamOrganizations: true,
  role: 'user',
  permissions: ['organization:read', 'membership:read', 'webhook:read'],
};

describe('settings access matrix (L6b)', () => {
  beforeEach(() => {
    disabledModulesRef.value = new Set();
  });

  it('billing + members open when modules are enabled and RBAC allows', () => {
    expect(
      canViewSettingsSection(
        { scope: 'account', section: 'billing' },
        { role: 'user', permissions: ['organization:read'] },
      ),
    ).toBe(true);
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'members' },
        teamAdminCtx,
      ),
    ).toBe(true);
  });

  it('billing + members blocked when modules are disabled despite RBAC', () => {
    disabledModulesRef.value = new Set(['billing', 'members']);
    expect(
      canViewSettingsSection(
        { scope: 'account', section: 'billing' },
        { role: 'user', permissions: ['organization:read'] },
      ),
    ).toBe(false);
    expect(
      isSettingsSectionAvailable(
        { scope: 'organization', section: 'members' },
        teamAdminCtx,
      ),
    ).toBe(false);
  });
});
