import { appToday } from './app-time.ts';
import { LEAD_CLOSED_STATUSES, type LeadRecord } from './leads-contracts.ts';

/*
 * Hold, claim and release on clinozy-be (D40, L9): a claim holds a lead for the organization's
 * `lead_hold_days` (`held_until`); while the hold runs only its owner works it, and once it has
 * passed — or the owner released it — anyone on the team may claim it. A closed lead is neither
 * held nor claimed. The server decides every claim (`409 lead_held`, `409 lead_closed`); this
 * only reads `held_until` for the row's state, the Team column's dot and the drawer's line.
 */

const DAY_MS = 86_400_000;
const CLOSED = new Set<string>(LEAD_CLOSED_STATUSES);

/** A lead closed by its status: it is never held and can't be claimed. */
export function isLeadClosed(lead: Pick<LeadRecord, 'status'>): boolean {
  return CLOSED.has(lead.status);
}

/** Where a lead stands with its owner and the team. */
export interface LeadHold {
  /** Closed by its status — never held. */
  closed: boolean;
  /** No running hold: anyone on the team may claim it. */
  open: boolean;
  /** When the running hold ends; `null` when open or closed. */
  releasesAt: string | null;
  /** The hold ends today, on the clinic's calendar (the Ownership filter's "Releasing today"). */
  releasesToday: boolean;
  /** The hold ends within a day — the Team column's dot. */
  releasesWithinDay: boolean;
}

/** Where a lead stands at `now`: held while `held_until` is ahead, open once it has passed. */
export function leadHold(
  lead: Pick<LeadRecord, 'status' | 'heldUntil'>,
  now: Date,
): LeadHold {
  const closed = isLeadClosed(lead);
  const end = lead.heldUntil ? Date.parse(lead.heldUntil) : Number.NaN;
  const held = !closed && end > now.getTime();
  return {
    closed,
    open: !(closed || held),
    releasesAt: held ? lead.heldUntil : null,
    releasesToday: held && appToday(new Date(end)) === appToday(now),
    releasesWithinDay: held && end - now.getTime() <= DAY_MS,
  };
}
