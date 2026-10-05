/**
 * The search schemas of the Leads room — New lead's prefill on `create/` (`S:23`).
 * Kept out of `leads.search.ts` on purpose: `routeTree.tsx` (the entry chunk)
 * imports that module for the page's `validateSearch`, so a dialog's schema there
 * ships on every first paint. The dialog route only types its search from here
 * (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer parses it,
 * and this module loads with the room.
 */
import { textOf } from '@/lib/routes/search-params.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';

/** The New lead prefill (`S:23`; ⌘K "New lead", contact card "+ Lead"). */
export interface LeadCreateSearch {
  /** The person's name, as given (≤ 120 characters, the contract's). */
  name?: string;
  /** Their mobile, E.164 — a typed or pasted 10-digit Indian mobile. */
  phone?: string;
}

/**
 * Parse the `/leads/create` prefill. Both values are personal data: the
 * telemetry scrub filters `name` and `phone` from every captured URL
 * (`SENSITIVE_QUERY_PARAMS`).
 */
export function validateLeadCreateSearch(
  search: Record<string, unknown>,
): LeadCreateSearch {
  const name = textOf(search.name);
  const phone = textOf(search.phone);
  return {
    name: name && name.length <= 120 ? name : undefined,
    phone: (phone && toClinicPhone(phone)) || undefined,
  };
}
