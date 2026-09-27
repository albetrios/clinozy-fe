import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    environment: 'development',
    captchaDisabled: false,
    turnstileSiteKey: '',
  },
}));

import { authCaptchaHeaders } from './auth-captcha-headers.ts';
import { DEV_CAPTCHA_TOKEN } from './captcha.constants.ts';

describe('authCaptchaHeaders', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the dev token in development when Turnstile is not configured', () => {
    expect(authCaptchaHeaders()).toEqual({ 'X-Captcha-Token': DEV_CAPTCHA_TOKEN });
  });

  it('prefers an explicit captcha token when provided', () => {
    expect(authCaptchaHeaders('turnstile-token')).toEqual({
      'X-Captcha-Token': 'turnstile-token',
    });
  });
});
