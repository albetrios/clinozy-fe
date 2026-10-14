import { NewBranchPage } from './NewBranchPage.tsx';

/**
 * New branch route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Branches page opens the drawer).
 */
export function Component() {
  return <NewBranchPage />;
}
