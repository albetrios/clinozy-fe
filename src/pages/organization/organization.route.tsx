import { OrganizationPickerPage } from './OrganizationPickerPage.tsx';

/**
 * Organization picker route — lazy loaded.
 * Exports `Component` for the router's lazy() resolution; auth guard runs in
 * routeTree `beforeLoad`.
 */
export function Component() {
  return <OrganizationPickerPage />;
}
