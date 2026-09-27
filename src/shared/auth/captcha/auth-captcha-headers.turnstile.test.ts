import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    environment: 'development',
    captchaDisabled: false,
    turnstileSiteKey: 'test-site-key',
  },
}));

import { authCaptchaHeaders } from './auth-captcha-headers.ts';
import { setTurnstileToken } from './turnstile-token-store.ts';

describe('authCaptchaHeaders (turnstile provider)', () => {
  afterEach(() => {
    setTurnstileToken(undefined);
  });

  it('attaches the background turnstile token when one is available', () => {
    setTurnstileToken('bg-token');
    expect(authCaptchaHeaders()).toEqual({ 'X-Captcha-Token': 'bg-token' });
  });

  it('omits the header when no background token is available', () => {
    expect(authCaptchaHeaders()).toBeUndefined();
  });

  it('prefers an explicit token over the background token', () => {
    setTurnstileToken('bg-token');
    expect(authCaptchaHeaders('explicit')).toEqual({ 'X-Captcha-Token': 'explicit' });
  });
});
