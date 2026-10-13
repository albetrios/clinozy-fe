import { NewSupplierPage } from './NewSupplierPage.tsx';

/**
 * New supplier route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Suppliers list opens the drawer).
 */
export function Component() {
  return <NewSupplierPage />;
}
