import { MfaPage } from './MfaPage.tsx';

/**
 * MFA route — TOTP verification after login when MFA is enabled.
 * Exports `Component` for the router's lazy() resolution.
 * Shell: the pathless `auth-shell` route in routeTree mounts AuthLayout.
 */
export function Component() {
  return <MfaPage />;
}
