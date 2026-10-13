import { EditPurchaseOrderPage } from './EditPurchaseOrderPage.tsx';

/**
 * Edit purchase order route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Purchases list opens the drawer).
 */
export function Component() {
  return <EditPurchaseOrderPage />;
}
