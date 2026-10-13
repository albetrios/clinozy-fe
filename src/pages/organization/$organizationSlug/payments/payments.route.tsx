import { PaymentsPage } from './PaymentsPage.tsx';

/**
 * Payments route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution.
 */
export function Component() {
  return <PaymentsPage />;
}
