import { TaskPage } from './TaskPage.tsx';

/**
 * Task drawer route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the list opens the drawer).
 */
export function Component() {
  return <TaskPage />;
}
