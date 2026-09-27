import { platformConfig } from '@/core/config/env.ts';

export type CaptchaProvider = 'disabled' | 'dev' | 'turnstile';

/**
 * Whether auth continue actions must pass a captcha gate before proceeding.
 * Env-driven only — disabled when `VITE_CAPTCHA_DISABLED=true` (tests inject this
 * via the `clinozyFeTestEnv` Vitest plugin). No build-mode sniffing.
 */
export function isCaptchaEnabled(): boolean {
  return !platformConfig.captchaDisabled;
}

/** Which captcha surface to render inside the auth dialog. */
export function resolveCaptchaProvider(): CaptchaProvider {
  if (!isCaptchaEnabled()) return 'disabled';
  if (platformConfig.turnstileSiteKey) return 'turnstile';
  return 'dev';
}

/** Whether public auth must wait for a background Turnstile token before POST. */
export function isTurnstileCaptchaGateActive(): boolean {
  return (
    isCaptchaEnabled() &&
    resolveCaptchaProvider() === 'turnstile' &&
    Boolean(platformConfig.turnstileSiteKey)
  );
}
