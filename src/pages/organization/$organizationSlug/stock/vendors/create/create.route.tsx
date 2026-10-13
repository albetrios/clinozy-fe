import { NewStockVendorPage } from './NewStockVendorPage.tsx';

/**
 * New clinic vendor route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Vendors list opens the drawer).
 */
export function Component() {
  return <NewStockVendorPage />;
}
