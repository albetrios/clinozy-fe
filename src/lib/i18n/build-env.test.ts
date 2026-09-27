import { afterEach, describe, expect, it, vi } from 'vitest';

describe('buildEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('resolves i18n mode from VITE_I18N_BUILD_MODE', async () => {
    vi.stubEnv('VITE_I18N_BUILD_MODE', 'multi');
    const { readInjectedI18nMode } = await import('./build-env.ts');
    expect(readInjectedI18nMode()).toBe('multi');
  });

  it('exposes build id and version when injected', async () => {
    vi.stubEnv('VITE_APP_BUILD_ID', 'build-abc');
    vi.stubEnv('VITE_APP_VERSION', '1.2.3');
    const { readInjectedAppBuildId, readInjectedAppVersion } =
      await import('./build-env.ts');
    expect(readInjectedAppBuildId()).toBe('build-abc');
    expect(readInjectedAppVersion()).toBe('1.2.3');
  });
});
