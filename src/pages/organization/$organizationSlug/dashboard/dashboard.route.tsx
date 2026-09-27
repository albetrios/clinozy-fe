import { DashboardPage } from './DashboardPage.tsx';

/**
 * Dashboard route — lazy loaded.
 * Exports `Component` for React Router's lazy() resolution.
 */
export function Component() {
  return <DashboardPage />;
}
