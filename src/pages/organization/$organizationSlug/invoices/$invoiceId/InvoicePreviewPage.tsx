import { Outlet } from '@tanstack/react-router';

/**
 * The `/invoices/$invoiceId` route's own UI: only its child's outlet (the
 * edit). It is a URL-driven dialog over its referrer (KICKOFF §4, D24) — the
 * invoices island reads the URL and opens the preview, so a refresh or a
 * shared link reopens it.
 */
export function InvoicePreviewPage() {
  return <Outlet />;
}
