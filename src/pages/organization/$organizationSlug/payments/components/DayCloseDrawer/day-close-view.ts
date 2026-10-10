import {
  MONEY_SCALE,
  numberFromText,
  paiseOfRupees,
  rupeesOfPaise,
} from '@/lib/number-text.ts';
import type { Branch, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import type { LedgerPerson } from '@/shared/api/clinic/payments-contracts.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';

/*
 * What Day close says about a day (KICKOFF §6.9 Day close; H:5083–5125) — pure, so the bar, the
 * cards and the log read one set of rules. Every figure is clinozy-be's, in rupees; the one sum
 * here is the preview of the count being typed (typed less the server's expected cash), which
 * the server's own difference replaces once the day closes.
 */

/** A difference's paint: none yet, a matched drawer, or a gap (H:5124). */
export type DifferenceTone = 'none' | 'match' | 'gap';

/**
 * The count being typed against the server's expected cash — a preview, none before a count (or
 * before there is an expected cash). Compared in paise, so ₹0.10 + ₹0.20 is ₹0.30.
 */
export function countDifference(
  counted: number | null,
  expected: number | null,
): number | null {
  if (counted === null || expected === null) return null;
  return rupeesOfPaise(paiseOfRupees(counted) - paiseOfRupees(expected));
}

/** How a difference is painted: "—" muted, "₹0" sage, "+₹X" / "−₹X" blush. */
export function differenceTone(difference: number | null): DifferenceTone {
  if (difference === null) return 'none';
  return difference === 0 ? 'match' : 'gap';
}

/** The pill's tone for a difference tone — `none` reads on the muted fill. */
export const DIFFERENCE_TONES: Readonly<Record<DifferenceTone, Tone | 'neutral'>> = {
  none: 'neutral',
  match: 'sage',
  gap: 'blush',
};

/** "—", "₹0", "+₹40" or "−₹40" — a difference (rupees) as the pill and the report write it. */
export function differenceText(
  difference: number | null,
  formatRupees: (rupees: number) => string,
): string {
  if (difference === null) return '—';
  if (difference === 0) return formatRupees(0);
  return `${difference > 0 ? '+' : '−'}${formatRupees(Math.abs(difference))}`;
}

/**
 * The branch Day close reviews (Q-G6, AMBER): the URL's when it is one of the member's branches,
 * else the header's one branch, else the member's own (the team directory's), else the main
 * branch — `null` while the branches load.
 */
export function dayCloseBranchId({
  branches,
  branchFilter,
  ownBranchIds,
  requested,
}: {
  branches: readonly Pick<Branch, 'id' | 'isMain'>[];
  branchFilter: readonly string[];
  ownBranchIds: readonly string[];
  requested: string | undefined;
}): string | null {
  const open = new Set(branches.map((branch) => branch.id));
  if (requested && open.has(requested)) return requested;
  const shown = branchFilter.filter((id) => open.has(id));
  if (shown.length === 1) return shown[0] ?? null;
  const own = ownBranchIds.find((id) => open.has(id));
  return own ?? defaultBranchId(branches, branchFilter);
}

/** The status pill (H:5112): its words, by key, and its tone. */
export type DayStatus =
  | { kind: 'closedBy'; name: string; tone: 'sage' }
  | { kind: 'forceClosed'; tone: 'sage' }
  | { kind: 'closed'; tone: 'sage' }
  | { kind: 'open'; tone: 'sky' }
  | { kind: 'openAuto'; hours: number; tone: 'butter' };

/**
 * "Closed by Riya S." / "Force-closed" (the worker closed it, `close_kind: auto`) — sage; today
 * open "Open" — sky; a past day open "Open · auto-closes in 15 h" — butter.
 */
export function dayStatus(
  view: Pick<DayCloseView, 'state' | 'closedBy' | 'autoClosed' | 'autoClosesInHours'>,
): DayStatus {
  if (view.state === 'closed') {
    if (view.autoClosed) return { kind: 'forceClosed', tone: 'sage' };
    return view.closedBy
      ? { kind: 'closedBy', name: view.closedBy.name, tone: 'sage' }
      : { kind: 'closed', tone: 'sage' };
  }
  return view.autoClosesInHours === null
    ? { kind: 'open', tone: 'sky' }
    : { kind: 'openAuto', hours: view.autoClosesInHours, tone: 'butter' };
}

/** One step of the day, as "What happened" words it. */
type DayLogKind =
  /** The opening accepted as carried: "Riya S. accepted the opening cash ₹2,000". */
  | 'accepted'
  /** The opening of a recounted day — its recount follows: "Riya S. opened the day". */
  | 'opened'
  /** "Riya S. accepted the opening cash ₹1,900 (recounted)". */
  | 'recounted'
  /** The day's standing close: who, then the count against the expected cash, then the reason. */
  | 'counted'
  /** A close a reopen undid — its figures are gone: "Riya S. closed the day". */
  | 'closed'
  /** "Auto-closed after the grace period · cash taken as expected". */
  | 'auto'
  /** "Riya S. reopened the day · Counted wrong" — the reason as typed. */
  | 'reopened';

/** One line of "What happened" (H:5121): its dot, time, who and words, by kind. */
export interface DayLogRow {
  id: string;
  kind: DayLogKind;
  tone: Tone;
  at: string;
  person: LedgerPerson | null;
  /** Someone did it (`membership_id` set) — the worker's own steps are no one's. */
  byMember: boolean;
  /** A reopen's reason as typed — the one server `text` the log shows (PAY-M4). */
  reason: string | null;
}

const LOG_TONES: Readonly<Record<DayLogKind, Tone>> = {
  accepted: 'sky',
  opened: 'sky',
  recounted: 'peach',
  counted: 'sage',
  closed: 'sage',
  auto: 'sage',
  reopened: 'butter',
};

/** The last close of a closed day — the one whose count the record still holds. */
function standingCloseId(view: Pick<DayCloseView, 'state' | 'events'>): string | null {
  if (view.state !== 'closed') return null;
  const closes = view.events.filter(
    (event) => event.kind === 'closed' || event.kind === 'auto_closed',
  );
  return closes.at(-1)?.id ?? null;
}

/** An event's line kind — by its `kind` and the day it belongs to. */
function logKindOf(
  event: DayCloseView['events'][number],
  view: Pick<DayCloseView, 'opening'>,
  standing: string | null,
): DayLogKind {
  switch (event.kind) {
    case 'opened':
      return view.opening.source === 'recounted' ? 'opened' : 'accepted';
    case 'recounted':
      return 'recounted';
    case 'closed':
      return event.id === standing ? 'counted' : 'closed';
    case 'auto_closed':
      return 'auto';
    case 'reopened':
      return 'reopened';
  }
}

/**
 * "What happened", oldest first — each of the server's events (B27) worded by its `kind` and the
 * day's figures, never by its English `text`, save a reopen's reason (PAY-M4). Only the day's
 * standing close carries the count: a close a reopen undid lost its figures with it.
 */
export function dayLog(
  view: Pick<DayCloseView, 'state' | 'events' | 'opening'>,
): DayLogRow[] {
  const standing = standingCloseId(view);
  return view.events.map((event) => {
    const kind = logKindOf(event, view, standing);
    return {
      id: event.id,
      kind,
      tone: LOG_TONES[kind],
      at: event.at,
      person: event.by,
      byMember: event.membershipId !== null,
      reason: kind === 'reopened' ? event.text : null,
    };
  });
}

/** The typed cash in rupees — up to two decimals — or null while empty. */
export function typedRupees(text: string): number | null {
  return text.trim() === '' ? null : rupeesOfPaise(numberFromText(text, MONEY_SCALE));
}

/**
 * Whether closing on this count needs a reason: it differs from the server's expected cash
 * (`difference_reason` is required then — a 400 otherwise).
 */
export function countNeedsReason(
  counted: number | null,
  expected: number | null,
): boolean {
  const difference = countDifference(counted, expected);
  return difference !== null && difference !== 0;
}
