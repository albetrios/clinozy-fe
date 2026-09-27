import { describe, expect, it } from 'vitest';

import {
  isCanonicalSettingsHash,
  isSettingsHash,
  normalizeSettingsHash,
  SETTINGS_HASH_PREFIX,
  settingsHash,
  settingsHashPath,
} from './settings-hash-grammar.ts';

describe('settings-hash-grammar (dependency-free leaf)', () => {
  it('exposes the settings hash prefix', () => {
    expect(SETTINGS_HASH_PREFIX).toBe('settings');
  });

  it('builds the hash value without a leading #', () => {
    expect(settingsHash('account', 'profile')).toBe('settings/account/profile');
    expect(settingsHash('organization', 'general')).toBe('settings/organization/general');
  });

  it('composes with the prefix constant', () => {
    expect(settingsHash('account', 'security')).toBe(
      `${SETTINGS_HASH_PREFIX}/account/security`,
    );
  });
});

describe('isSettingsHash', () => {
  it('matches the bare prefix and prefixed paths', () => {
    expect(isSettingsHash('settings')).toBe(true);
    expect(isSettingsHash('#settings/account/profile')).toBe(true);
    expect(isSettingsHash('settings/organization/general')).toBe(true);
  });

  it('rejects non-settings hashes', () => {
    expect(isSettingsHash('')).toBe(false);
    expect(isSettingsHash('#other')).toBe(false);
    expect(isSettingsHash('settingsfoo')).toBe(false);
  });
});

describe('settingsHashPath / normalizeSettingsHash', () => {
  it('strips the leading # and any trailing ?query or #fragment', () => {
    expect(settingsHashPath('#settings/account/profile')).toBe(
      'settings/account/profile',
    );
    expect(settingsHashPath('settings/account/profile?tab=1')).toBe(
      'settings/account/profile',
    );
    expect(normalizeSettingsHash('#settings/organization/general')).toBe(
      'settings/organization/general',
    );
  });

  it('returns non-settings hashes unchanged (minus the leading #)', () => {
    expect(settingsHashPath('#not-settings')).toBe('not-settings');
  });
});

describe('isCanonicalSettingsHash', () => {
  it('is true only for the exact canonical deep link of a ref', () => {
    const ref = { scope: 'account', section: 'profile' } as const;
    expect(isCanonicalSettingsHash('#settings/account/profile', ref)).toBe(true);
    expect(isCanonicalSettingsHash('settings/account/profile', ref)).toBe(true);
    expect(isCanonicalSettingsHash('#settings/account/security', ref)).toBe(false);
  });
});
