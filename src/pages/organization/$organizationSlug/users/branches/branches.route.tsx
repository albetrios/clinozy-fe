import { BranchesPage } from './BranchesPage.tsx';

/**
 * Branches route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution.
 */
export function Component() {
  return <BranchesPage />;
}
