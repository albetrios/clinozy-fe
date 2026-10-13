import { PurchaseOrderPage } from './PurchaseOrderPage.tsx';

/**
 * Purchase order route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders only its child routes (the Purchases list opens the drawer).
 */
export function Component() {
  return <PurchaseOrderPage />;
}
