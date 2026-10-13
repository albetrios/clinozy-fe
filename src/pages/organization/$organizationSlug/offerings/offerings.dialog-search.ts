/**
 * The search schemas of the Offerings room — New offering's `?name=` on `create/`
 * (`S:99`). Kept out of `offerings.search.ts` on purpose: `routeTree.tsx` (the
 * entry chunk) imports that module for the page's `validateSearch`, so a dialog's
 * schema there ships on every first paint. The dialog route only types its search
 * from here (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer
 * parses it, and this module loads with the room.
 */
import { textOf } from '@/lib/routes/search-params.ts';

/** The New offering prefill (`S:99`): the name typed where it was asked for. */
export interface OfferingCreateSearch {
  /** The offering's name, as given (≤ 120 characters, the contract's). */
  name?: string;
}

/** Parse the `/offerings/create` prefill. */
export function validateOfferingCreateSearch(
  search: Record<string, unknown>,
): OfferingCreateSearch {
  const name = textOf(search.name);
  return { name: name && name.length <= 120 ? name : undefined };
}
