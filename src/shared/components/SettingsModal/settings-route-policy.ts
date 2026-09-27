/**
 * Routes where the global settings hash modal must not open — focused funnels
 * where a full-screen overlay would fight the page (onboarding, auth, invites).
 * App surfaces (dashboard, org URLs, picker) remain allowed.
 */
const SETTINGS_BLOCKED_PATH_PREFIXES = [
  '/onboarding',
  '/login',
  '/callback',
  '/mfa',
  '/accept-invite',
] as const;

/** Whether `#settings/…` may mount on this pathname. */
export function isSettingsPathAllowed(pathname: string): boolean {
  return !SETTINGS_BLOCKED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
