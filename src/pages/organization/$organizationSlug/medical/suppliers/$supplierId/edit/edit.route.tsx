import { EditSupplierPage } from './EditSupplierPage.tsx';

/**
 * Edit supplier route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Suppliers list opens the drawer).
 */
export function Component() {
  return <EditSupplierPage />;
}
