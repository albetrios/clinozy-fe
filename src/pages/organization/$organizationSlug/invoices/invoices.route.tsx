import { InvoicesLayout } from './InvoicesLayout.tsx';

/**
 * Invoices island route — lazy loaded. Exports `Component` for the router's
 * lazy() resolution: the dialog host that opens New invoice, the preview and
 * Edit invoice over the Payments ledger (`routeTree.tsx` renders the ledger
 * beside it).
 */
export function Component() {
  return <InvoicesLayout />;
}
