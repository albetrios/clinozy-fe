import { LoginPage } from './LoginPage.tsx';

/**
 * Login route — lazy loaded.
 * Exports `Component` for the router's lazy() resolution.
 * Shell: the pathless `auth-shell` route in routeTree mounts AuthLayout.
 * Access: `authShellRoute.beforeLoad` → `redirectIfAuthenticated` (not an island loader).
 */
export function Component() {
  return <LoginPage />;
}
