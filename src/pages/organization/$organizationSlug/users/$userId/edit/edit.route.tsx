import { EditUserPage } from './EditUserPage.tsx';

/**
 * Edit user route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Users page opens the drawer).
 */
export function Component() {
  return <EditUserPage />;
}
