import { SaleReturnPage } from './SaleReturnPage.tsx';

/**
 * Return from patient route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Sales list opens the drawer).
 */
export function Component() {
  return <SaleReturnPage />;
}
