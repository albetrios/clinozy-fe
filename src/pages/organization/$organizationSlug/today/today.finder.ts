/**
 * The floor finder (change-today-command-center, BRIEF.md change 3): who on today's floor a
 * query names — by any word of their name from its start (accents and case ignored), or by
 * three or more digits of a booking's phone. Pure; `FloorFinder` words and shows the matches.
 */
import type { TodayLane } from '@/shared/api/app/today-contracts.ts';

import type { TodayCard, TodayLanes } from './today.lanes.ts';

/** The most results the finder lists. */
export const FLOOR_FINDER_LIMIT = 8;

/** A phone query needs this many digits — fewer would match half the floor. */
const PHONE_DIGITS_MIN = 3;

/** A query made only of a phone number's characters. */
const PHONE_QUERY = /^[\d\s+()-]+$/;

/** One person the query names, and where in their name it matched. */
export interface FloorFinderMatch {
  card: TodayCard;
  /**
   * The matched part of the name, `[start, end)` — for the result's highlight; null for a
   * phone match, or a name whose accents change its length when folded.
   */
  range: readonly [number, number] | null;
}

/** Lower case without accents — "Ánanya" and "ananya" are one name. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

/**
 * Where a folded query starts a word of a folded name — the name's start, or just after a
 * space — or -1: "riya" finds "Riya Shah" and "Anaya Riya", never "Supriya".
 */
function wordStartIndex(name: string, query: string): number {
  if (name.startsWith(query)) return 0;
  const index = name.indexOf(` ${query}`);
  return index === -1 ? -1 : index + 1;
}

/** A card's phone digits, when the floor has a phone for them (an enquiry has none here). */
function phoneDigits(card: TodayCard): string {
  return card.kind === 'booking' ? (card.row.phone ?? '').replaceAll(/\D/g, '') : '';
}

/** A parsed query: a phone's digits, or a folded name. */
interface FinderQuery {
  byPhone: boolean;
  digits: string;
  folded: string;
}

/** One card against the query: its match and rank (0 a name's first word, 1 a later one), or null. */
function matchCard(
  card: TodayCard,
  query: FinderQuery,
): { match: FloorFinderMatch; rank: number } | null {
  if (query.byPhone) {
    return phoneDigits(card).includes(query.digits)
      ? { match: { card, range: null }, rank: 0 }
      : null;
  }
  const name = fold(card.name);
  const index = wordStartIndex(name, query.folded);
  if (index === -1) return null;
  const exact = name.length === card.name.length;
  return {
    match: { card, range: exact ? [index, index + query.folded.length] : null },
    rank: index === 0 ? 0 : 1,
  };
}

/**
 * Everyone on the floor (`visible` lanes only, in their order) the query names: name matches
 * whose first word matches before later-word matches, then by lane, then time. Empty for a
 * blank query.
 */
export function findOnFloor({
  lanes,
  visible,
  query,
}: {
  lanes: TodayLanes;
  visible: readonly TodayLane[];
  query: string;
}): FloorFinderMatch[] {
  const trimmed = query.trim();
  if (trimmed === '') return [];
  const digits = trimmed.replaceAll(/\D/g, '');
  const parsed: FinderQuery = {
    byPhone: PHONE_QUERY.test(trimmed) && digits.length >= PHONE_DIGITS_MIN,
    digits,
    folded: fold(trimmed).replaceAll(/\s+/g, ' '),
  };
  const ranked = visible.flatMap((lane) =>
    lanes[lane].flatMap((card) => {
      const found = matchCard(card, parsed);
      return found ? [found] : [];
    }),
  );
  // A stable sort keeps the lanes' order and each lane's time order within a rank.
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.map(({ match }) => match);
}
