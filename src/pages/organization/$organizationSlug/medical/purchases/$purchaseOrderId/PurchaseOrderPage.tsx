import { Outlet } from '@tanstack/react-router';

/**
 * The `/medical/purchases/$purchaseOrderId` route's own UI: none but its child dialog routes. It is a
 * URL-driven dialog over the Purchases list (KICKOFF §4, D24) — the
 * Purchases page reads the URL and opens the drawer over itself, so a
 * refresh or a shared link reopens it.
 */
export function PurchaseOrderPage() {
  return <Outlet />;
}
