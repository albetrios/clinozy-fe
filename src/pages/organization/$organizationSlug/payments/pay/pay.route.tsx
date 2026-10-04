import { SendPaymentPage } from './SendPaymentPage.tsx';

/**
 * Send payment route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Payments ledger opens the drawer).
 */
export function Component() {
  return <SendPaymentPage />;
}
