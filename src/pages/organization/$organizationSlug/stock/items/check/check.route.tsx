import { StockCheckPage } from './StockCheckPage.tsx';

/**
 * Stock check route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Items list opens the drawer).
 */
export function Component() {
  return <StockCheckPage />;
}
