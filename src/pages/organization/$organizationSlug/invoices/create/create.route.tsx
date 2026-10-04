import { NewInvoicePage } from './NewInvoicePage.tsx';

/**
 * New invoice route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the invoices island opens the drawer).
 */
export function Component() {
  return <NewInvoicePage />;
}
