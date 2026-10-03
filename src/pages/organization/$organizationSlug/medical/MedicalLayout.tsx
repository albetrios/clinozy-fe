import { Outlet } from '@tanstack/react-router';

/**
 * Medical room layout: its tabs render here as child routes (D24); the bare
 * `/medical` URL redirects to its first tab (/medical/sales — the room opens on Sales (D25).).
 */
export function MedicalLayout() {
  return (
    <div data-testid="medical-page" className="flex min-h-0 flex-1 flex-col">
      <Outlet />
    </div>
  );
}
