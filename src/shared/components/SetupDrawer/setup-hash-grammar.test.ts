import { describe, expect, it } from 'vitest';

import { isSetupHash, parseSetupHash, setupHash } from './setup-hash-grammar.ts';

describe('setup hash grammar', () => {
  it('builds the drawer address, bare or at a step', () => {
    expect(setupHash()).toBe('setup');
    expect(setupHash('location')).toBe('setup/location');
  });

  it('recognizes the drawer hash with or without #, and nothing else', () => {
    expect(isSetupHash('#setup')).toBe(true);
    expect(isSetupHash('setup/you')).toBe(true);
    expect(isSetupHash('#setup/guide?x=1')).toBe(true);
    expect(isSetupHash('#settings/organization/clinic')).toBe(false);
    expect(isSetupHash('#setups')).toBe(false);
    expect(isSetupHash('')).toBe(false);
  });

  it('parses a known step, null for bare or unknown, undefined for another hash', () => {
    expect(parseSetupHash('#setup/clinic-type')).toBe('clinic-type');
    expect(parseSetupHash('#setup/live')).toBe('live');
    expect(parseSetupHash('#setup')).toBeNull();
    expect(parseSetupHash('#setup/nowhere')).toBeNull();
    expect(parseSetupHash('#settings/account/profile')).toBeUndefined();
  });
});
