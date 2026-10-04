import { Outlet } from '@tanstack/react-router';

/**
 * The `/medical/sales/$saleId` route's own UI: none but its child dialog routes. It is a
 * URL-driven dialog over the Sales list (KICKOFF §4, D24) — the
 * Sales page reads the URL and opens the drawer over itself, so a
 * refresh or a shared link reopens it.
 */
export function SalePage() {
  return <Outlet />;
}
