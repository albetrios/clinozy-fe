import { CallbackPage } from './CallbackPage.tsx';

/**
 * Auth callback route — lazy loaded.
 * Exports `Component` for the router's lazy() resolution.
 */
export function Component() {
  return <CallbackPage />;
}
