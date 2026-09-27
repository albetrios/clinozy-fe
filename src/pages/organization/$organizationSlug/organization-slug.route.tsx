import { OrganizationLayout } from './OrganizationLayout.tsx';

/**
 * Organization shell route — lazy loaded.
 * Exports `Component` for the router's lazy() resolution. The guard chain
 * (auth → organization context → status) runs in routeTree `beforeLoad`;
 * see `app/guards/GUARDS.OVERVIEW.md`.
 */
export function Component() {
  return <OrganizationLayout />;
}
