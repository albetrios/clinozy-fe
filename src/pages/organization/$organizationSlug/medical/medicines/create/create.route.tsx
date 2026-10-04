import { NewMedicinePage } from './NewMedicinePage.tsx';

/**
 * New medicine route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Medicines list opens the drawer).
 */
export function Component() {
  return <NewMedicinePage />;
}
