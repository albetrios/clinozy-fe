import { clinicToday } from './clinic-time.ts';
import { LEAD_CLOSED_STATUSES, type LeadRecord } from './leads-fixture-contracts.ts';

/*
 * The fixture world's hold (`__czHold` H:3869), for the fixture task rules: an owner holds a lead
 * while they work it; after `holdDays` without their activity it opens to the team. The Leads
 * room reads clinozy-be's `held_until` instead (`leads-hold.ts`); this goes with the fixture
 * task rules.
 */

/**
 * Days without the owner's activity before a lead opens to the team — an org
 * setting, 3 by default (H:4013). Its "Auto-release after" control is never
 * rendered (H:5738) and isn't built, so every org runs the default.
 */
export const LEAD_HOLD_DAYS = 3;

const DAY_MS = 86_400_000;
const CLOSED = new Set<string>(LEAD_CLOSED_STATUSES);

/** A lead closed by its status, or linked to a patient: it never releases and can't be claimed. */
export function isLeadClosed(lead: Pick<LeadRecord, 'status' | 'patientId'>): boolean {
  return (lead.status !== null && CLOSED.has(lead.status)) || lead.patientId !== null;
}

/** What the hold reads: the lead, and whether its owner has left the clinic (or there is none). */
export type LeadHoldSubject = Pick<
  LeadRecord,
  'status' | 'patientId' | 'touchedAt' | 'releasedAt'
> & {
  ownerGone: boolean;
};

/** Where a lead stands with its owner and the team. */
export interface LeadHold {
  /** Closed or linked to a patient — never released. */
  closed: boolean;
  /** Its owner left the clinic, or it has none — anyone on the team can join and take it. */
  ownerGone: boolean;
  /** Its owner let it go ("Release") and hasn't touched it since. */
  released: boolean;
  /** Anyone on the team may claim it. */
  open: boolean;
  /** Whole days since the owner's last activity ("No activity for <n> days"). */
  idleDays: number;
  /** When it opens to the team if nobody follows up; `null` once open, or when it never will. */
  releasesAt: string | null;
  /** It opens later today (the Ownership filter's "Releasing today"). */
  releasesToday: boolean;
  /** It opens within a day — the Team column's 7px dot. */
  releasesWithinDay: boolean;
}

/**
 * Where a lead stands (`__czHold`, H:3869): closed leads never release; idle
 * time runs from the owner's last activity (Q-L9); the lead opens once
 * `holdDays` have passed, the owner releases it, or the owner has left. The
 * prototype counts whole days, so "Releasing today" matched leads releasing
 * tomorrow (H:5636) — here the release is an instant, and "today" is the
 * clinic's (§7.3).
 */
export function leadHold(lead: LeadHoldSubject, holdDays: number, now: Date): LeadHold {
  const closed = isLeadClosed(lead);
  const touched = Date.parse(lead.touchedAt);
  const idleDays = Math.max(0, Math.floor((now.getTime() - touched) / DAY_MS));
  const released = lead.releasedAt !== null && Date.parse(lead.releasedAt) >= touched;
  const releaseTime = touched + holdDays * DAY_MS;
  const open = !closed && (lead.ownerGone || released || releaseTime <= now.getTime());
  const held = !(closed || open);
  return {
    closed,
    ownerGone: lead.ownerGone,
    released,
    open,
    idleDays,
    releasesAt: held ? new Date(releaseTime).toISOString() : null,
    releasesToday: held && clinicToday(new Date(releaseTime)) === clinicToday(now),
    releasesWithinDay: held && releaseTime - now.getTime() <= DAY_MS,
  };
}
