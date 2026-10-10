/**
 * The search schemas of the Patients room — New patient's prefill on `create/`
 * (`S:31`). Kept out of `patients.search.ts` on purpose: `routeTree.tsx` (the
 * entry chunk) imports that module for the page's `validateSearch`, so a dialog's
 * schema there ships on every first paint. The dialog route only types its search
 * from here (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer
 * parses it, and this module loads with the room.
 */
import { PUBLIC_ID, textOf } from '@/lib/routes/search-params.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';

/** The New patient prefill (`S:31`; ⌘K "New patient", the contact card's "+ Patient"). */
export interface PatientCreateSearch {
  /** The person's name, as given (≤ 120 characters): the first word fills First name, the rest Last name. */
  name?: string;
  /** Their mobile, E.164 — a typed or pasted 10-digit Indian mobile. */
  phone?: string;
  /** The lead the patient comes from (`lead_…`) — the file opens on its person. */
  fromLead?: string;
}

/**
 * Parse the `/patients/create` prefill. `name` and `phone` are personal data:
 * the telemetry scrub filters both from every captured URL
 * (`SENSITIVE_QUERY_PARAMS`).
 */
export function validatePatientCreateSearch(
  search: Record<string, unknown>,
): PatientCreateSearch {
  const name = textOf(search.name);
  const phone = textOf(search.phone);
  const fromLead = textOf(search.fromLead);
  return {
    name: name && name.length <= 120 ? name : undefined,
    phone: (phone && toClinicPhone(phone)) || undefined,
    fromLead:
      PUBLIC_ID.test(fromLead) && fromLead.startsWith('lead_') ? fromLead : undefined,
  };
}
