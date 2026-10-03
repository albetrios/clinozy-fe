import { Outlet } from '@tanstack/react-router';

/**
 * Clinic stock room layout: its tabs render here as child routes (D24); the bare
 * `/stock` URL redirects to its first tab (/stock/items — the room opens on Items.).
 */
export function StockLayout() {
  return (
    <div data-testid="stock-page" className="flex min-h-0 flex-1 flex-col">
      <Outlet />
    </div>
  );
}
