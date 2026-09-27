import { CAPTCHA_TOKEN_HEADER, DEV_CAPTCHA_TOKEN } from './captcha.constants.ts';
import { isCaptchaEnabled, resolveCaptchaProvider } from './captcha-config.ts';
import { consumeTurnstileToken } from './turnstile-token-store.ts';

/**
 * Optional captcha header for public auth POSTs (`X-Captcha-Token`).
 *
 * Resolution order: an explicit token (callers that already hold one), then the background
 * Turnstile token kept fresh by the invisible widget, then the fixed dev token when Turnstile
 * is not configured. Returns `undefined` (header omitted) when captcha is disabled or no token
 * is available.
 */
export function authCaptchaHeaders(
  captchaToken?: string,
): Record<string, string> | undefined {
  if (!isCaptchaEnabled()) return undefined;
  const token = captchaToken ?? resolveBackgroundCaptchaToken();
  if (!token) return undefined;
  return { [CAPTCHA_TOKEN_HEADER]: token };
}

/** Token to send when no caller-supplied token is available, based on the active provider. */
function resolveBackgroundCaptchaToken(): string | undefined {
  switch (resolveCaptchaProvider()) {
    case 'turnstile':
      return consumeTurnstileToken();
    case 'dev':
      return DEV_CAPTCHA_TOKEN;
    default:
      return undefined;
  }
}
