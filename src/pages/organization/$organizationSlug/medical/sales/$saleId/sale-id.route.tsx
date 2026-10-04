import { SalePage } from './SalePage.tsx';

/**
 * Sale route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders only its child routes (the Sales list opens the drawer).
 */
export function Component() {
  return <SalePage />;
}
