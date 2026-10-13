import { NewTaskPage } from './NewTaskPage.tsx';

/**
 * New task route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the list opens the drawer).
 */
export function Component() {
  return <NewTaskPage />;
}
