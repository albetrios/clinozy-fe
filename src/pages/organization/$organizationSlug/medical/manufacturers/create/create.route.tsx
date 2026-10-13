import { NewManufacturerPage } from './NewManufacturerPage.tsx';

/**
 * New manufacturer route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Manufacturers list opens the drawer).
 */
export function Component() {
  return <NewManufacturerPage />;
}
