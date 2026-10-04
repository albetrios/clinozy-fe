import { MONEY_SCALE, numberFromText } from '@/lib/number-text.ts';
import type { Branch, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import type { LedgerPerson } from '@/shared/api/clinic/payments-contracts.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';

/*
 * What Day close says about a day (KICKOFF §6.9 Day close; H:5083–5125) —
 * pure, so the bar, the cards and the log read one set of rules.
 */

/** A difference's paint: none yet, a matched drawer, or a gap (H:5124). */
export type DifferenceTone = 'none' | 'match' | 'gap';

/** The drawer's difference: counted less expected, none before a count. */
export function cashDifference(counted: number | null, expected: number): number | null {
  return counted === null ? null : counted - expected;
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

/** "—", "₹0", "+₹40" or "−₹40" — a difference as the pill and the report write it. */
export function differenceText(
  difference: number | null,
  formatPaise: (paise: number) => string,
): string {
  if (difference === null) return '—';
  if (difference === 0) return formatPaise(0);
  return `${difference > 0 ? '+' : '−'}${formatPaise(Math.abs(difference))}`;
}

/** A net by mode: "−₹260", "₹600", "₹0" — a minus only (H:5110). */
export function netText(paise: number, formatPaise: (paise: number) => string): string {
  return `${paise < 0 ? '−' : ''}${formatPaise(Math.abs(paise))}`;
}

/**
 * The branch Day close reviews (Q-G6, AMBER): the URL's when it is an open
 * branch, else the header's one branch, else the member's own, else the main
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
 * "Closed by Riya S." / "Force-closed" (the job closed it) — sage; today open
 * "Open" — sky; a past day open "Open · auto-closes in 15 h" — butter.
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

/** One line of "What happened" (H:5121): its dot, time, who and words, by key. */
export interface DayLogRow {
  id: 'accepted' | 'reviewed' | 'counted' | 'closed';
  tone: Tone;
  /** When, as an instant; null shows "—". */
  at: string | null;
  person: LedgerPerson | null;
}

/**
 * The report's log, in order: the opening accepted, the entries reviewed (when
 * any were ticked), the drawer counted, then the close — a person's, or the
 * job's "Auto-closed after the grace period".
 */
export function dayLog(
  view: Pick<
    DayCloseView,
    | 'openingAcceptedAt'
    | 'acceptedBy'
    | 'checkedIds'
    | 'countedCash'
    | 'closedAt'
    | 'closedBy'
    | 'autoClosed'
  >,
): DayLogRow[] {
  const rows: DayLogRow[] = [];
  if (view.openingAcceptedAt) {
    rows.push({
      id: 'accepted',
      tone: 'sky',
      at: view.openingAcceptedAt,
      person: view.acceptedBy,
    });
  }
  if (view.checkedIds.length > 0) {
    rows.push({ id: 'reviewed', tone: 'lav', at: null, person: view.closedBy });
  }
  if (view.countedCash !== null && !view.autoClosed) {
    rows.push({
      id: 'counted',
      tone: 'butter',
      at: view.closedAt,
      person: view.closedBy,
    });
  }
  rows.push({ id: 'closed', tone: 'sage', at: view.closedAt, person: view.closedBy });
  return rows;
}

/** The typed cash in paise — rupees with up to two decimals — or null while empty. */
export function typedPaise(text: string): number | null {
  return text.trim() === '' ? null : numberFromText(text, MONEY_SCALE);
}
