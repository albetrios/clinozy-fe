import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The leads hooks' toasts live in the room's own namespace: only the Leads
 * room fires them (its drawers and rows), and that namespace loads with its
 * route. A caller elsewhere passes its own `successMessage`.
 */
export const LEAD_TOASTS_NS = I18N_NAMESPACES.leads;

/** The toasts the leads writes raise, verbatim from KICKOFF §6.3. */
export const LEAD_TOASTS_KEYS = {
  /** "Lead #2386 created". */
  created: 'toasts.created',
  /** A save that kept the status. */
  saved: 'toasts.saved',
  /** "Rhea Shah → Follow-up", with Undo. */
  statusChanged: 'toasts.statusChanged',
  /** A claim from the row, with Undo. */
  claimed: 'toasts.claimed',
  /** A claim of a lead nobody held, with Undo. */
  claimedUnowned: 'toasts.claimedUnowned',
  released: 'toasts.released',
  /** "<name> is now assigned · notified", with Undo. */
  assigned: 'toasts.assigned',
  /** " · follow-up task for tomorrow", after a move to Follow-up. */
  followUpTask: 'toasts.followUpTask',
  /** "Patient record created for <name> · lead stays linked", with Undo. */
  converted: 'toasts.converted',
} as const;
