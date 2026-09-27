import { useSyncExternalStore } from 'react';

import { isTurnstileCaptchaGateActive } from '@/shared/auth/captcha/captcha-config.ts';
import {
  peekTurnstileToken,
  subscribeTurnstileToken,
} from '@/shared/auth/captcha/turnstile-token-store.ts';

/**
 * Whether public auth actions may proceed (Turnstile token minted when required).
 * Returns `true` immediately when captcha is off or the dev provider is active.
 */
export function useTurnstileReady(): boolean {
  const gateActive = isTurnstileCaptchaGateActive();

  const hasToken = useSyncExternalStore(
    subscribeTurnstileToken,
    () => Boolean(peekTurnstileToken()),
    () => true,
  );

  return !gateActive || hasToken;
}
