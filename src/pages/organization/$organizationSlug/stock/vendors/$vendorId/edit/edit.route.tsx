import { EditStockVendorPage } from './EditStockVendorPage.tsx';

/**
 * Edit clinic vendor route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Vendors list opens the drawer).
 */
export function Component() {
  return <EditStockVendorPage />;
}
