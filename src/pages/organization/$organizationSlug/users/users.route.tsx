import { UsersPage } from './UsersPage.tsx';

/**
 * Users route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution.
 */
export function Component() {
  return <UsersPage />;
}
