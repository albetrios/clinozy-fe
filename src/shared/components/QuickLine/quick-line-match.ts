/*
 * The quick line's search (H:3790–3797): how a typed word matches a catalogue
 * entry, the best matches, the name to add as typed and Browse's narrowing —
 * the prototype's one engine, whatever the line adds (offerings, medicines).
 * Pure; the grammar that pulls numbers out of a line is the host's.
 */

/** What the search reads of an entry: its label and the extra words it answers to. */
export interface QuickLineSearchable {
  label: string;
  /** A composition, a category, search terms — matched like the label's words. */
  keywords?: string;
}

/** How many matches the line lists (H:3791 `slice(0, 8)`). */
export const QUICK_LINE_MATCH_LIMIT = 8;

/** The separators the label and keywords split into words on (H:3791). */
const WORD_BREAKS = /[\s\-·/,()]+/;

/**
 * The numbers the catalogue's names carry ("Flubolt 400", "SPF 50"): a bare
 * one of those in a line is part of a name, not a quantity (H:3861 `nums`).
 */
export function nameNumbers(labels: readonly string[]): Set<string> {
  return new Set(
    labels
      .flatMap((label) => label.toLowerCase().split(/[\s\-·/]+/))
      .filter((word) => /^\d+$/.test(word)),
  );
}

/** Whether `term` reads in order inside `text` (H:3791 `subq`): "flbt" in "flubolt400". */
function inOrder(term: string, text: string): boolean {
  let at = 0;
  for (const char of text) {
    if (char === term[at]) at += 1;
    if (at === term.length) return true;
  }
  return false;
}

/**
 * How well one word matches an entry — lower is better, `null` for no match
 * (H:3791): the label's start 0, a word's start 1, anywhere 2, its letters in
 * order through the label (three letters or more) 4.
 */
export function quickLineWordScore(
  word: string,
  entry: QuickLineSearchable,
): number | null {
  const label = entry.label.toLowerCase();
  const text = `${label} ${(entry.keywords ?? '').toLowerCase()}`;
  if (label.startsWith(word)) return 0;
  if (text.split(WORD_BREAKS).some((part) => part.startsWith(word))) return 1;
  if (text.includes(word)) return 2;
  if (word.length >= 3 && inOrder(word, label.replace(/\s+/g, ''))) return 4;
  return null;
}

/**
 * The line's matches (H:3790–3792): with words, the entries every word
 * matches, best first — the catalogue's order breaking ties; with none, the
 * often-used ones first and then the catalogue. At most eight.
 */
export function quickLineMatches<T extends QuickLineSearchable>(
  catalog: readonly T[],
  words: readonly string[],
  often: readonly T[] = [],
  limit = QUICK_LINE_MATCH_LIMIT,
): T[] {
  if (words.length === 0) {
    const rest = catalog.filter((entry) => !often.includes(entry));
    return [...often, ...rest].slice(0, limit);
  }
  const scored: { entry: T; score: number }[] = [];
  catalog.forEach((entry, index) => {
    let score = index / 1e4;
    for (const word of words) {
      const one = quickLineWordScore(word, entry);
      if (one === null) return;
      score += one;
    }
    scored.push({ entry, score });
  });
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((match) => match.entry);
}

/**
 * The name a line adds "as typed" when the catalogue lacks it (H:3793): each
 * word capitalised — `null` with no words, or when an entry has that name.
 */
export function quickLineTypedName(
  catalog: readonly QuickLineSearchable[],
  words: readonly string[],
): string | null {
  const term = words.join(' ');
  if (!term) return null;
  if (catalog.some((entry) => entry.label.toLowerCase() === term)) return null;
  return term.replace(/(^|\s)\S/g, (start) => start.toUpperCase());
}

/** Browse's narrowing (H:3797): an entry stays when its label or keywords hold every word. */
export function quickLineBrowseMatches(
  entry: QuickLineSearchable,
  words: readonly string[],
): boolean {
  const text = `${entry.label} ${entry.keywords ?? ''}`.toLowerCase();
  return words.every((word) => text.includes(word));
}
