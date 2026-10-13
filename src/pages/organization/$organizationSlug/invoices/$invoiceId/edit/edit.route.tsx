import { EditInvoicePage } from './EditInvoicePage.tsx';

/**
 * Edit invoice route — lazy loaded. Exports `Component` for the router's
 * lazy() resolution; it renders nothing (the invoices island opens the drawer).
 */
export function Component() {
  return <EditInvoicePage />;
}
