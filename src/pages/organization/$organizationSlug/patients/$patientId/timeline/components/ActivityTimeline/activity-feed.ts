import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';

import type { StaffChip } from '../../../shared/hooks/useStaffLookup/index.ts';

/** What an activity row is (H:4841 `TLK`). */
type ActivityKind = 'visit' | 'rx' | 'treat' | 'inv' | 'pay' | 'photo' | 'note';

/** A filter chip: everything, or one kind. */
export type ActivityFilter = 'all' | ActivityKind;

/** The chips in their order (H:4841): All · Visits · Prescriptions … Notes. */
export const ACTIVITY_FILTERS: readonly ActivityFilter[] = [
  'all',
  'visit',
  'rx',
  'treat',
  'inv',
  'pay',
  'photo',
  'note',
];

/** Each kind's tone — its row's icon tile and its chip's ink (H:4841). */
export const ACTIVITY_TONES: Readonly<Record<ActivityFilter, Tone>> = {
  all: 'stone',
  visit: 'sky',
  rx: 'sage',
  treat: 'lav',
  inv: 'butter',
  pay: 'mint',
  photo: 'blush',
  note: 'stone',
};

/** One record on the timeline, in the viewer's words. */
export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  /** The clinic day it falls on, `YYYY-MM-DD`. */
  day: string;
  /** The instant it sorts by — a record with a day only sorts at 09:00 (H:4839). */
  at: string;
  /** "11:05 am"; none for a record with a day only. */
  time: string | null;
  title: string;
  sub: string;
  badge: { label: string; tone: Tone } | null;
  by: StaffChip | null;
  /** A photo's file — the collapsed row's thumbnails. */
  fileUrl?: string;
  open: () => void;
}

/** A row of the timeline: an entry, or the day's photos collapsed into one (H:4853). */
export interface ActivityRow extends ActivityEntry {
  /** The entries it stands for — one, or the day's photos. */
  entries: ActivityEntry[];
  /** It starts a new day (the day header above it). */
  newDay: boolean;
}

/** Newest first (ISO instants compare as text); a tie keeps the order the entries came in. */
const newestFirst = (a: ActivityEntry, b: ActivityEntry) => b.at.localeCompare(a.at);

/**
 * The timeline's rows (H:4852–4862): the entries of the chip in force,
 * newest first; a photo right after another of the same day joins its row
 * ("3 photos"); each row knows whether it starts a new day.
 */
export function activityRows(
  entries: readonly ActivityEntry[],
  filter: ActivityFilter,
): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const entry of [...entries].sort(newestFirst)) {
    if (filter !== 'all' && entry.kind !== filter) continue;
    const last = rows.at(-1);
    if (entry.kind === 'photo' && last?.kind === 'photo' && last.day === entry.day) {
      last.entries.push(entry);
      continue;
    }
    rows.push({ ...entry, entries: [entry], newDay: last?.day !== entry.day });
  }
  return rows;
}

/** How many entries each chip holds (H:4864); a chip of none hides. */
export function activityCounts(
  entries: readonly ActivityEntry[],
): Readonly<Record<ActivityFilter, number>> {
  const counts = Object.fromEntries(
    ACTIVITY_FILTERS.map((filter) => [filter, 0]),
  ) as Record<ActivityFilter, number>;
  for (const entry of entries) {
    counts.all += 1;
    counts[entry.kind] += 1;
  }
  return counts;
}
