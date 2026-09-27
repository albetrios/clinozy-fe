import { describe, expect, it } from 'vitest';

import {
  localeBuildProfileFor,
  resolveBuildI18nBcp47,
  resolveBuildI18nMode,
  uiLocaleFromBcp47,
} from './build-config.ts';

describe('resolveBuildI18nMode', () => {
  it('defaults to single', () => {
    expect(resolveBuildI18nMode(undefined)).toBe('single');
    expect(resolveBuildI18nMode('')).toBe('single');
    expect(resolveBuildI18nMode('bogus')).toBe('single');
  });

  it('accepts multi explicitly', () => {
    expect(resolveBuildI18nMode('multi')).toBe('multi');
  });
});

describe('resolveBuildI18nBcp47', () => {
  it('defaults to en-US', () => {
    expect(resolveBuildI18nBcp47(undefined)).toBe('en-US');
  });

  it('normalizes casing', () => {
    expect(resolveBuildI18nBcp47('en-us')).toBe('en-US');
    expect(resolveBuildI18nBcp47('es-mx')).toBe('es-MX');
  });
});

describe('uiLocaleFromBcp47', () => {
  it('maps en-US to en', () => {
    expect(uiLocaleFromBcp47('en-US')).toBe('en');
  });

  it('falls back to en for unknown primaries', () => {
    expect(uiLocaleFromBcp47('xx-YY')).toBe('en');
  });
});

describe('localeBuildProfileFor', () => {
  it('derives USD for en-US', () => {
    expect(localeBuildProfileFor('en-US')).toMatchObject({
      locale: 'en',
      formatLocale: 'en-US',
      currencyCode: 'USD',
    });
  });
});
