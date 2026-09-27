import {
  platformConfig,
  resolveLayoutWidth,
  resolveLayoutWidthForced,
  resolveThemeLock,
} from './env.ts';

describe('resolveLayoutWidth', () => {
  it('defaults to contained', () => {
    expect(resolveLayoutWidth(undefined)).toBe('contained');
    expect(resolveLayoutWidth('contained')).toBe('contained');
    expect(resolveLayoutWidth('anything-else')).toBe('contained');
  });

  it('returns full only for the explicit "full" flag', () => {
    expect(resolveLayoutWidth('full')).toBe('full');
  });
});

describe('resolveThemeLock', () => {
  it('is true only for the explicit "true" flag', () => {
    expect(resolveThemeLock('true')).toBe(true);
    expect(resolveThemeLock('false')).toBe(false);
    expect(resolveThemeLock(undefined)).toBe(false);
    expect(resolveThemeLock('1')).toBe(false);
  });
});

describe('resolveLayoutWidth', () => {
  it('maps env flag to layout width ids', () => {
    expect(resolveLayoutWidth(undefined)).toBe('contained');
    expect(resolveLayoutWidth('full')).toBe('full');
    expect(resolveLayoutWidth('reading')).toBe('reading');
    expect(resolveLayoutWidth('bogus')).toBe('contained');
  });
});

describe('resolveLayoutWidthForced', () => {
  it('returns null when env omits layout width', () => {
    expect(resolveLayoutWidthForced(undefined)).toBeNull();
  });

  it('locks when env sets a valid layout width', () => {
    expect(resolveLayoutWidthForced('full')).toBe('full');
    expect(resolveLayoutWidthForced('reading')).toBe('reading');
    expect(resolveLayoutWidthForced('contained')).toBe('contained');
  });
});

describe('platformConfig', () => {
  it('platformConfig.layoutWidthForced is null or a layout id', () => {
    expect(
      platformConfig.layoutWidthForced === null ||
        ['contained', 'full', 'reading'].includes(platformConfig.layoutWidthForced),
    ).toBe(true);
  });

  it('platformConfig.themeLock is a boolean', () => {
    expect(typeof platformConfig.themeLock).toBe('boolean');
  });

  it('platformConfig.environment is a string', () => {
    expect(typeof platformConfig.environment).toBe('string');
    expect(['local', 'development', 'production', 'test']).toContain(
      platformConfig.environment,
    );
  });

  it('exposes no isDevelopment/isProduction booleans (env-driven only)', () => {
    expect('isDevelopment' in platformConfig).toBe(false);
    expect('isProduction' in platformConfig).toBe(false);
  });

  it('sentry sample rates are numbers in 0..1', () => {
    for (const rate of [
      platformConfig.sentryTracesSampleRate,
      platformConfig.sentryReplaysSessionSampleRate,
      platformConfig.sentryProfilesSampleRate,
      platformConfig.sentryReplaysOnErrorSampleRate,
    ]) {
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('platformConfig.apiBaseUrl is a string', () => {
    expect(typeof platformConfig.apiBaseUrl).toBe('string');
  });
});
