import { civilDayOffset, clinicToday } from '@/shared/api/clinic/clinic-time.ts';

/**
 * The Leads grid (`ldColsVM`, H:4176–4181): six columns in order, each with
 * its CSS track and the minimum width the row adds up. Lead is always shown;
 * Interested in and Team never sort.
 */
export const LEADS_COLUMNS = [
  { id: 'name', track: 'minmax(160px,1.5fr)', min: 160 },
  { id: 'status', track: 'minmax(104px,.8fr)', min: 104 },
  { id: 'source', track: 'minmax(116px,.7fr)', min: 116 },
  { id: 'interests', track: 'minmax(96px,.9fr)', min: 96 },
  { id: 'team', track: 'minmax(150px,1.2fr)', min: 150 },
  { id: 'updated', track: '84px', min: 84 },
] as const;

/** One Leads column's id. */
export type LeadsColumnId = (typeof LEADS_COLUMNS)[number]['id'];

/** A Leads column's track and minimum, by id. */
export function leadsColumn(id: LeadsColumnId) {
  const column = LEADS_COLUMNS.find((entry) => entry.id === id);
  if (!column) throw new Error(`Unknown leads column ${id}`);
  return column;
}

/** The 12px gap between the grid's columns. */
const COLUMN_GAP = 12;
/** The row's padding, edge and slack the prototype adds (H:4181). */
const ROW_EXTRA = 60;

/**
 * The row's minimum width with these columns showing (H:4181): the sum of
 * their minimums, 12px between each two, and 60 — 830px with all six. A
 * narrower card scrolls the rows sideways and the header follows.
 */
export function leadTableMinWidth(visible: readonly LeadsColumnId[]): number {
  if (visible.length === 0) return 0;
  const minimums = visible.reduce((sum, id) => sum + leadsColumn(id).min, 0);
  return minimums + COLUMN_GAP * (visible.length - 1) + ROW_EXTRA;
}

/** How "Updated" reads (H:6149): just now, minutes or hours today, then days, weeks, a date. */
export type LeadUpdatedLabel =
  | { kind: 'justNow' }
  | { kind: 'minutes'; count: number }
  | { kind: 'hours'; count: number }
  | { kind: 'yesterday' }
  | { kind: 'days'; count: number }
  | { kind: 'weeks'; count: number }
  | { kind: 'date' };

const MINUTE_MS = 60_000;

/**
 * The prototype's "Updated" words (`human`, H:6149), on the clinic's calendar:
 * today "Just now" (a minute or less), "<n> min ago", "<n> h ago" (rounded);
 * then "Yesterday", "<n> days ago" under a week, "<n> weeks ago" under 30
 * days, and the date itself beyond that.
 */
export function leadUpdatedLabel(iso: string, now: Date = new Date()): LeadUpdatedLabel {
  const at = new Date(iso);
  const days = civilDayOffset(clinicToday(at), clinicToday(now));
  if (days <= 0) {
    const minutes = Math.floor((now.getTime() - at.getTime()) / MINUTE_MS);
    if (minutes <= 1) return { kind: 'justNow' };
    if (minutes < 60) return { kind: 'minutes', count: minutes };
    return { kind: 'hours', count: Math.round(minutes / 60) };
  }
  if (days === 1) return { kind: 'yesterday' };
  if (days < 7) return { kind: 'days', count: days };
  if (days < 30) return { kind: 'weeks', count: Math.floor(days / 7) };
  return { kind: 'date' };
}
