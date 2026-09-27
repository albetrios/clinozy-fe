import { describe, expect, it } from 'vitest';

import {
  enabledOAuthProviders,
  hasAnyAuthSurface,
  resolveAuthMethodFlag,
  resolveBooleanFlag,
  resolveDeploymentOverride,
  resolveDisabledModules,
  resolveOAuthProviderFlags,
  resolveSampleRate,
} from './env-resolvers.ts';

describe('env-resolvers', () => {
  it('resolveBooleanFlag: omitted/empty → default; only "false" disables', () => {
    expect(resolveBooleanFlag(undefined, true)).toBe(true);
    expect(resolveBooleanFlag('', true)).toBe(true);
    expect(resolveBooleanFlag(undefined, false)).toBe(false);
    expect(resolveBooleanFlag('false', true)).toBe(false);
    expect(resolveBooleanFlag('true', false)).toBe(true);
    expect(resolveBooleanFlag('1', false)).toBe(true);
  });

  it('resolveSampleRate: parses 0..1, else falls back to default', () => {
    expect(resolveSampleRate(undefined, 0.1)).toBeCloseTo(0.1);
    expect(resolveSampleRate('', 0.1)).toBeCloseTo(0.1);
    expect(resolveSampleRate('1', 0.1)).toBeCloseTo(1);
    expect(resolveSampleRate('0.25', 0.1)).toBeCloseTo(0.25);
    expect(resolveSampleRate('2', 0.1)).toBeCloseTo(0.1); // out of range
    expect(resolveSampleRate('-0.5', 0.1)).toBeCloseTo(0.1); // out of range
    expect(resolveSampleRate('abc', 0.1)).toBeCloseTo(0.1); // NaN
  });

  it('resolveAuthMethodFlag treats omitted as default', () => {
    expect(resolveAuthMethodFlag(undefined, true)).toBe(true);
    expect(resolveAuthMethodFlag(undefined, false)).toBe(false);
    expect(resolveAuthMethodFlag('false', true)).toBe(false);
    expect(resolveAuthMethodFlag('true', false)).toBe(true);
  });

  it('resolveDisabledModules parses comma list', () => {
    expect(resolveDisabledModules('billing, webhooks')).toEqual(
      new Set(['billing', 'webhooks']),
    );
  });

  it('resolveOAuthProviderFlags defaults apple off', () => {
    const flags = resolveOAuthProviderFlags(() => undefined);
    expect(flags.google).toBe(true);
    expect(flags.github).toBe(true);
    expect(flags.apple).toBe(false);
  });

  it('enabledOAuthProviders filters by env flags', () => {
    const oauth = { google: true, github: false, apple: true };
    expect(enabledOAuthProviders(oauth)).toEqual(['google', 'apple']);
  });

  it('hasAnyAuthSurface detects when all off', () => {
    expect(
      hasAnyAuthSurface({
        email: false,
        passkey: false,
        oauth: { google: false, github: false, apple: false },
      }),
    ).toBe(false);
  });

  it('resolveDeploymentOverride is tri-state', () => {
    expect(resolveDeploymentOverride(undefined)).toBeNull();
    expect(resolveDeploymentOverride('true')).toBe(true);
    expect(resolveDeploymentOverride('false')).toBe(false);
  });
});
