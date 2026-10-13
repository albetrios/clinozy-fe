import { NewUserPage } from './NewUserPage.tsx';

/**
 * New user route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Team opens the drawer).
 */
export function Component() {
  return <NewUserPage />;
}
