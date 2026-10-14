/** What {@link insertPhrase} hands back: the new text and where the caret goes. */
export interface InsertedPhrase {
  value: string;
  /** The caret just after the inserted phrase. */
  caret: number;
}

/** The characters a sentence ends on: `.`, `!`, `?`, the Devanagari danda `।`, a line break. */
const SENTENCE_ENDINGS = '.!?।\n';

/** A sentence starts after `before`: it is blank, or ends (spaces aside) on a sentence ending. */
function startsSentence(before: string): boolean {
  let index = before.length - 1;
  while (index >= 0 && (before[index] === ' ' || before[index] === '\t')) index -= 1;
  return index < 0 || SENTENCE_ENDINGS.includes(before.charAt(index));
}

function capitalizeFirst(phrase: string): string {
  const first = phrase.charAt(0);
  return first.toLocaleUpperCase() + phrase.slice(1);
}

/**
 * Write a dictated (or suggested) phrase into `value` between `start` and `end` — the caret or
 * selection, the end of the text by default: one space before it unless the text before already
 * ends in whitespace, one after it when a word follows, and a capital first letter where a sentence
 * starts. `maxLength` caps the result (the phrase is cut, never the text already there).
 *
 * @param input.value - The field's text now.
 * @param input.phrase - The words to insert (trimmed here).
 * @param input.start - Selection start; defaults to the end of `value`.
 * @param input.end - Selection end; defaults to `start`.
 * @param input.maxLength - The field's limit, when it has one.
 * @returns The new text and the caret after the phrase (and the space after it, if any).
 */
export function insertPhrase({
  value,
  phrase,
  start = value.length,
  end = start,
  maxLength,
}: {
  value: string;
  phrase: string;
  start?: number;
  end?: number;
  maxLength?: number;
}): InsertedPhrase {
  const words = phrase.trim();
  const before = value.slice(0, start);
  const after = value.slice(end);
  if (!words) return { value, caret: start };
  const lead = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
  const tail = after.length > 0 && !/^[\s.,;:!?]/.test(after) ? ' ' : '';
  let inserted = `${lead}${startsSentence(before) ? capitalizeFirst(words) : words}${tail}`;
  if (maxLength !== undefined) {
    const room = Math.max(0, maxLength - before.length - after.length);
    inserted = inserted.slice(0, room);
  }
  return {
    value: `${before}${inserted}${after}`,
    caret: before.length + inserted.length,
  };
}
