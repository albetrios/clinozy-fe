import { InvoicePreviewPage } from './InvoicePreviewPage.tsx';

/**
 * Invoice preview route — lazy loaded. Exports `Component` for the router's
 * lazy() resolution; it renders only its edit child's outlet (the invoices
 * island opens the preview).
 */
export function Component() {
  return <InvoicePreviewPage />;
}
