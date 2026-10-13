/**
 * The search schemas of the Medical room — the create drawers' prefills: New
 * medicine, New purchase order and New sale (`S:50–68`). Kept out of
 * `medical.search.ts` on purpose: `routeTree.tsx` (the entry chunk) imports that
 * module for the page's `validateSearch`, so a dialog's schema there ships on
 * every first paint. The dialog route only types its search from here
 * (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer parses it,
 * and this module loads with the room.
 */
import { oneOf, RECORD_ID, textOf } from '@/lib/routes/search-params.ts';

/**
 * The dialog routes' prefills: New medicine's `?name=`, New purchase order's
 * `?supplier=&reorder=low`, New sale's `?prescription=&customer=&from=`.
 */
export interface MedicalCreateSearch {
  /** A typed medicine name (≤ 120 characters). */
  name?: string;
  /** The supplier a new purchase order starts on. */
  supplier?: string;
  /** "Reorder low stock": every medicine at or below its reorder level (`S:57`). */
  reorder?: 'low';
  /** The prescription a new sale fills (`S:50`). */
  prescription?: string;
  /** The customer a new sale starts on. */
  customer?: string;
  /**
   * The room New sale opened from and closes back to — Today's Dispense sends
   * `from=today` (KICKOFF §4, AMBER A-P1). Raw here; the close checks it
   * against the referrer allow-list (`safeReferrer`).
   */
  from?: string;
}

/** Parse a Medical dialog route's prefill. */
export function validateMedicalCreateSearch(
  search: Record<string, unknown>,
): MedicalCreateSearch {
  const name = textOf(search.name);
  const one = (value: unknown) => {
    const text = textOf(value);
    return RECORD_ID.test(text) ? text : undefined;
  };
  return {
    name: name && name.length <= 120 ? name : undefined,
    supplier: one(search.supplier),
    reorder: oneOf(['low'] as const, search.reorder),
    prescription: one(search.prescription),
    customer: one(search.customer),
    from: textOf(search.from) || undefined,
  };
}
