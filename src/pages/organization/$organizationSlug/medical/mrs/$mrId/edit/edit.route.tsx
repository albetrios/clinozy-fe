import { EditMrPage } from './EditMrPage.tsx';

/**
 * Edit MR route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the MRs list opens the drawer).
 */
export function Component() {
  return <EditMrPage />;
}
