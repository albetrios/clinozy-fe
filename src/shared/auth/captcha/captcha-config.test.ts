import { afterEach, describe, expect, it, vi } from 'vitest';

const envRef = vi.hoisted(() => ({
  captchaDisabled: false,
  turnstileSiteKey: undefined as string | undefined,
}));

vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    get captchaDisabled() {
      return envRef.captchaDisabled;
    },
    get turnstileSiteKey() {
      return envRef.turnstileSiteKey;
    },
  },
}));

import {
  isCaptchaEnabled,
  isTurnstileCaptchaGateActive,
  resolveCaptchaProvider,
} from './captcha-config.ts';

describe('captcha-config', () => {
  afterEach(() => {
    envRef.captchaDisabled = false;
    envRef.turnstileSiteKey = undefined;
  });

  it('uses dev checkbox when enabled without a Turnstile site key', () => {
    expect(isCaptchaEnabled()).toBe(true);
    expect(resolveCaptchaProvider()).toBe('dev');
  });

  it('uses Turnstile when a site key is configured', () => {
    envRef.turnstileSiteKey = 'test-site-key';
    expect(resolveCaptchaProvider()).toBe('turnstile');
  });

  it('respects VITE_CAPTCHA_DISABLED', () => {
    envRef.captchaDisabled = true;
    expect(isCaptchaEnabled()).toBe(false);
  });

  it('detects when Turnstile gate is active', () => {
    envRef.turnstileSiteKey = 'test-site-key';
    expect(isTurnstileCaptchaGateActive()).toBe(true);
  });
});
