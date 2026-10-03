import { TasksPage } from './TasksPage.tsx';

/**
 * Tasks route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution.
 */
export function Component() {
  return <TasksPage />;
}
