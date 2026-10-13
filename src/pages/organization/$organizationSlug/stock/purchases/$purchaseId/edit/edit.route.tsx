import { EditStockPurchasePage } from './EditStockPurchasePage.tsx';

/**
 * Edit purchase route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Purchases list opens the drawer).
 */
export function Component() {
  return <EditStockPurchasePage />;
}
