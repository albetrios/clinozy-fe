import { NewOfferPage } from './NewOfferPage.tsx';

/**
 * New offer route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the Offers tab opens the drawer).
 */
export function Component() {
  return <NewOfferPage />;
}
