import { describe, expect, it } from 'vitest';

import { __testEnabledOAuthFromGet } from './env-schema.ts';
import { resolvePlatformConfig } from './platform-config.ts';

describe('platform-config', () => {
  it('resolvePlatformConfig applies oauth auto-google only when google enabled', () => {
    const platform = resolvePlatformConfig(
      (key) => {
        if (key === 'AUTH_OAUTH_AUTO_GOOGLE') return 'true';
        if (key === 'AUTH_OAUTH_GOOGLE') return 'false';
        return undefined;
      },
      { VITE_APP_ENV: 'local', DEV: true, PROD: false },
    );
    expect(platform.authMethods.oauthAutoGoogle).toBe(false);
  });

  it('testMode reflects the VITE_TEST_MODE flag (off by default, on when "true")', () => {
    const off = resolvePlatformConfig(() => undefined, { VITE_APP_ENV: 'local' });
    expect(off.testMode).toBe(false);

    const on = resolvePlatformConfig(
      (key) => (key === 'TEST_MODE' ? 'true' : undefined),
      {
        VITE_APP_ENV: 'local',
      },
    );
    expect(on.testMode).toBe(true);
  });

  it('strips trailing slashes from apiBaseUrl so path joins never double up', () => {
    const platform = resolvePlatformConfig(
      (key) => (key === 'API_BASE_URL' ? 'https://api.example.com//' : undefined),
      { VITE_APP_ENV: 'production', DEV: false, PROD: true },
    );
    expect(platform.apiBaseUrl).toBe('https://api.example.com');
  });

  it('apiBaseUrl is purely env-driven — empty API_BASE_URL yields "" regardless of mode', () => {
    // No build-mode branch anymore: local dev proxies by setting VITE_API_BASE_URL=''.
    const platform = resolvePlatformConfig(() => undefined, {
      VITE_APP_ENV: 'development',
      DEV: true,
      PROD: false,
    });
    expect(platform.apiBaseUrl).toBe('');
  });

  it('diagnostics/devtools/e2e default off and version-check on when unset', () => {
    const platform = resolvePlatformConfig(() => undefined, {
      VITE_APP_ENV: 'production',
      DEV: false,
      PROD: true,
    });
    expect(platform.debugLogging).toBe(false);
    expect(platform.devtools).toBe(false);
    expect(platform.e2eHooks).toBe(false);
    expect(platform.versionCheckEnabled).toBe(true);
  });

  it('diagnostics flags flip from env values', () => {
    const values: Record<string, string> = {
      DEBUG_LOGGING: 'true',
      DEVTOOLS: 'true',
      E2E_HOOKS: 'true',
      VERSION_CHECK: 'false',
    };
    const platform = resolvePlatformConfig((key) => values[key], {
      VITE_APP_ENV: 'development',
      DEV: true,
      PROD: false,
    });
    expect(platform.debugLogging).toBe(true);
    expect(platform.devtools).toBe(true);
    expect(platform.e2eHooks).toBe(true);
    expect(platform.versionCheckEnabled).toBe(false);
  });

  it('enabled oauth providers from env getters', () => {
    expect(
      __testEnabledOAuthFromGet((key) => {
        if (key === 'AUTH_OAUTH_GITHUB') return 'false';
        return undefined;
      }),
    ).toEqual(['google']);
  });
});
