/**
 * How wide a calendar's weekday headers read: `two` — the month grids' "Mo Tu
 * We" (the date picker, the booking and the filters calendars); `short` — the
 * locale's short name, "Mon" (the appointments week and month boards).
 */
export type WeekdayHeaderWidth = 'two' | 'short';

/** Scripts whose short weekday names cut cleanly to their first letters. */
const CUTTABLE =
  /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{M}\p{P}\p{Zs}\p{N}]+$/u;

/** The most letters a cut header keeps before the narrow form reads better ("Thứ 2" → "T2"). */
const MAX_CUT = 3;

/** 7 Jan 2024 — a Sunday, so day `n` of the reference week is `Date#getDay() === n`. */
const SUNDAY = Date.UTC(2024, 0, 7, 12);
const DAY_MS = 86_400_000;

const cache = new Map<string, readonly string[]>();

/** The seven names of one Intl width, Sunday first. */
function weekdayNames(locale: string, weekday: 'short' | 'narrow'): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday, timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, day) => format.format(SUNDAY + day * DAY_MS));
}

/** A name's user-perceived letters (`Intl.Segmenter`; code points where it is missing). */
function lettersOf(locale: string, name: string): string[] {
  // Drop the abbreviation's trailing period ("lun." → "lun").
  let end = name.length;
  while (end > 0 && ['.', ' '].includes(name.charAt(end - 1))) end -= 1;
  const trimmed = name.slice(0, end);
  if (typeof Intl.Segmenter !== 'function') return Array.from(trimmed);
  const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(trimmed), ({ segment }) => segment);
}

const distinct = (names: readonly string[]) => new Set(names).size === names.length;

/**
 * Two-letter headers, per script: Latin, Cyrillic and Greek cut the short
 * name to its first two letters — three where two would read two days alike
 * (Portuguese "seg" / "sex") — and every other script, or a cut that would
 * need more, takes the locale's own narrow form ("日 一 二", "ح ن ث",
 * "र सो मं", Vietnamese "T2 T3"), whose short form is a whole word or
 * repeats a prefix ("周一", "Thứ 2").
 */
function twoLetterHeaders(locale: string): string[] {
  const short = weekdayNames(locale, 'short');
  if (short.every((name) => CUTTABLE.test(name))) {
    const letters = short.map((name) => lettersOf(locale, name));
    for (let size = 2; size <= MAX_CUT; size += 1) {
      const cut = letters.map((name) => name.slice(0, size).join('').trim());
      if (distinct(cut)) return cut;
    }
  }
  const narrow = weekdayNames(locale, 'narrow');
  return distinct(narrow) ? narrow : short;
}

/**
 * The seven weekday headers a calendar draws, in the format locale, Sunday
 * first — index them with `Date#getDay()`, so each grid keeps the first day of
 * the week it already uses. Every calendar reads its headers here: `two` for
 * the month grids ("Mo Tu We", the design's), `short` for the boards ("Mon").
 * `Intl` has no two-letter width; {@link twoLetterHeaders} derives it.
 */
export function weekdayHeaders(
  formatLocale: string,
  width: WeekdayHeaderWidth = 'two',
): readonly string[] {
  const key = `${formatLocale}|${width}`;
  const known = cache.get(key);
  if (known) return known;
  let headers: readonly string[];
  try {
    headers =
      width === 'two'
        ? twoLetterHeaders(formatLocale)
        : weekdayNames(formatLocale, 'short');
  } catch {
    // A locale `Intl` rejects (a stale stored tag): English rather than a crash.
    headers = width === 'two' ? twoLetterHeaders('en') : weekdayNames('en', 'short');
  }
  cache.set(key, headers);
  return headers;
}
