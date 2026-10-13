import { NewPendingPage } from './NewPendingPage.tsx';

/**
 * Add pending route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Pending page opens the drawer).
 */
export function Component() {
  return <NewPendingPage />;
}
