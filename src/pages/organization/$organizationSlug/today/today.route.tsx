import { TodayPage } from './TodayPage.tsx';

/**
 * Today route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution.
 */
export function Component() {
  return <TodayPage />;
}
