import { NewMrPage } from './NewMrPage.tsx';

/**
 * New MR route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the MRs list opens the drawer).
 */
export function Component() {
  return <NewMrPage />;
}
