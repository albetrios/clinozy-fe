import { beforeEach, describe, expect, it, vi } from 'vitest';

const disabledModulesRef = vi.hoisted(() => ({ value: new Set<string>() }));
vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    get disabledModules() {
      return disabledModulesRef.value;
    },
  },
}));

import { isSettingsModuleEnabled, settingsSectionModuleKey } from './settings-modules.ts';

describe('settingsSectionModuleKey', () => {
  it('maps module-gated sections to catalog keys', () => {
    expect(settingsSectionModuleKey({ scope: 'account', section: 'billing' })).toBe(
      'billing',
    );
    expect(settingsSectionModuleKey({ scope: 'organization', section: 'members' })).toBe(
      'members',
    );
  });

  it('returns undefined for sections without a module gate', () => {
    expect(
      settingsSectionModuleKey({ scope: 'account', section: 'profile' }),
    ).toBeUndefined();
    expect(
      settingsSectionModuleKey({ scope: 'organization', section: 'roles' }),
    ).toBeUndefined();
  });
});

describe('isSettingsModuleEnabled', () => {
  beforeEach(() => {
    disabledModulesRef.value = new Set();
  });

  it('allows unmapped sections', () => {
    expect(isSettingsModuleEnabled({ scope: 'account', section: 'profile' })).toBe(true);
  });

  it('blocks disabled module sections', () => {
    disabledModulesRef.value = new Set(['billing', 'members']);
    expect(isSettingsModuleEnabled({ scope: 'account', section: 'billing' })).toBe(false);
    expect(isSettingsModuleEnabled({ scope: 'organization', section: 'members' })).toBe(
      false,
    );
    expect(isSettingsModuleEnabled({ scope: 'organization', section: 'roles' })).toBe(
      true,
    );
  });
});
