/**
 * The search schemas of the Users room — the member drawer's own params on
 * `$userId/edit/` (H:5188). Kept out of `users.search.ts` on purpose:
 * `routeTree.tsx` (the entry chunk) imports that module for the page's
 * `validateSearch`, so a dialog's schema there ships on every first paint. The
 * dialog route only types its search from here (`dialogSearch` in
 * `routeTree.tsx`); the page that opens the drawer parses it, and this module
 * loads with the room.
 */
import { oneOf } from '@/lib/routes/search-params.ts';

/** Where a member drawer can be opened from besides the Team. */
export const USER_DRAWER_ORIGINS = ['roles'] as const;

/** Validated `?…` search params the member drawer adds to the Team's. */
export interface UserEditSearch {
  /**
   * `roles` — opened from a role page's "People with this role": the Roles
   * page stays behind the drawer, on the role named by `role` (H:5188).
   */
  from?: (typeof USER_DRAWER_ORIGINS)[number];
}

/** Parse the member drawer's own search params (`/users/$userId/edit`). */
export function validateUserEditSearch(search: Record<string, unknown>): UserEditSearch {
  return { from: oneOf(USER_DRAWER_ORIGINS, search.from) };
}
