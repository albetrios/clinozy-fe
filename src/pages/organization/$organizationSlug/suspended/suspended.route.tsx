import { SuspendedPage } from './SuspendedPage.tsx';

/**
 * Suspended-organization route — lazy loaded.
 * Exports `Component` for the router's lazy() resolution.
 */
export function Component() {
  return <SuspendedPage />;
}
