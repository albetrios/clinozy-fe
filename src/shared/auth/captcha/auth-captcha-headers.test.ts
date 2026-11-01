import { afterEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({
  environment: 'development',
  captchaDisabled: false,
  turnstileSiteKey: '',
  testMode: true,
}));
vi.mock('@/core/config/env.ts', () => ({ platformConfig: config }));

import { authCaptchaHeaders } from './auth-captcha-headers.ts';
import { DEV_CAPTCHA_TOKEN } from './captcha.constants.ts';

describe('authCaptchaHeaders', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    config.testMode = true;
  });

  it('returns the dev token under the test runner when Turnstile is not configured', () => {
    expect(authCaptchaHeaders()).toEqual({ 'X-Captcha-Token': DEV_CAPTCHA_TOKEN });
  });

  it('sends no made-up token from a build without a site key — outside the test runner (F-5)', () => {
    config.testMode = false;
    expect(authCaptchaHeaders()).toBeUndefined();
    // A token the caller holds still goes out.
    expect(authCaptchaHeaders('turnstile-token')).toEqual({
      'X-Captcha-Token': 'turnstile-token',
    });
  });

  it('prefers an explicit captcha token when provided', () => {
    expect(authCaptchaHeaders('turnstile-token')).toEqual({
      'X-Captcha-Token': 'turnstile-token',
    });
  });
});
