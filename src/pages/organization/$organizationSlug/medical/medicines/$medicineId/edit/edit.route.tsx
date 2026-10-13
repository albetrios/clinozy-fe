import { EditMedicinePage } from './EditMedicinePage.tsx';

/**
 * Edit medicine route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Medicines list opens the drawer).
 */
export function Component() {
  return <EditMedicinePage />;
}
