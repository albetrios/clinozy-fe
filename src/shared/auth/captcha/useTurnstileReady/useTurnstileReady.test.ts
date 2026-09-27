import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const envRef = vi.hoisted(() => ({
  captchaDisabled: false,
  turnstileSiteKey: undefined as string | undefined,
}));

vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    environment: 'development',
    get captchaDisabled() {
      return envRef.captchaDisabled;
    },
    get turnstileSiteKey() {
      return envRef.turnstileSiteKey;
    },
  },
}));

import { setTurnstileToken } from '@/shared/auth/captcha/turnstile-token-store.ts';
import { useTurnstileReady } from '@/shared/auth/captcha/useTurnstileReady/useTurnstileReady.ts';

describe('useTurnstileReady', () => {
  afterEach(() => {
    envRef.captchaDisabled = false;
    envRef.turnstileSiteKey = undefined;
    setTurnstileToken(undefined);
  });

  it('is ready when Turnstile is not active', () => {
    const { result } = renderHook(() => useTurnstileReady());
    expect(result.current).toBe(true);
  });

  it('waits for a Turnstile token when the gate is active', () => {
    envRef.turnstileSiteKey = 'test-site-key';
    const { result, rerender } = renderHook(() => useTurnstileReady());
    expect(result.current).toBe(false);

    setTurnstileToken('token-abc');
    rerender();
    expect(result.current).toBe(true);
  });

  it('is ready when captcha is disabled', () => {
    envRef.turnstileSiteKey = 'test-site-key';
    envRef.captchaDisabled = true;
    const { result } = renderHook(() => useTurnstileReady());
    expect(result.current).toBe(true);
  });
});
