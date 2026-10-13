import { NewStockItemPage } from './NewStockItemPage.tsx';

/**
 * New item route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Items list opens the drawer).
 */
export function Component() {
  return <NewStockItemPage />;
}
