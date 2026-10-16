/** What {@link insertPhrase} hands back: the new text and where the caret goes. */
export interface InsertedPhrase {
  value: string;
  /** The caret just after the inserted phrase. */
  caret: number;
}

/** The characters a sentence ends on: `.`, `!`, `?`, the Devanagari danda `।`, a line break. */
const SENTENCE_ENDINGS = '.!?।\n';

/** A mark written straight after the words before it: Latin, Devanagari, Arabic and CJK punctuation. */
const GLUED_MARKS = '.,;:!?।،؟。，、？！：';

const isSpaceOrTab = (character: string) => character === ' ' || character === '\t';

/** `text` without the spaces and tabs at its end; line breaks stay. */
function trimEndSpaces(text: string): string {
  let end = text.length;
  while (end > 0 && isSpaceOrTab(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
}

/**
 * `text` without the spaces and tabs at either end — line breaks stay, so a spoken "new line"
 * survives the trim.
 *
 * @param text - The words.
 * @returns The words, trimmed of spaces and tabs only.
 */
export function trimSpaces(text: string): string {
  return trimEndSpaces(trimStartSpaces(text));
}

/** `text` without the spaces and tabs at its start. */
function trimStartSpaces(text: string): string {
  let start = 0;
  while (start < text.length && isSpaceOrTab(text.charAt(start))) start += 1;
  return text.slice(start);
}

/** A sentence starts after `before`: it is blank, or ends (spaces aside) on a sentence ending. */
function startsSentence(before: string): boolean {
  const text = trimEndSpaces(before);
  return text === '' || SENTENCE_ENDINGS.includes(text.charAt(text.length - 1));
}

/**
 * `phrase` with its first letter in capitals — a sentence's start.
 *
 * @param phrase - The words.
 * @returns The same words, the first letter upper-cased.
 */
export function capitalizeFirst(phrase: string): string {
  const first = phrase.charAt(0);
  return first.toLocaleUpperCase() + phrase.slice(1);
}

/**
 * The text around a phrase and the phrase as it goes in: spaced from the words on either side,
 * glued to the words before when it opens on a mark or a line break, capitalised where a sentence
 * starts; a line break written mid-text starts the next line on its first word, not on a space.
 */
function placeWords({
  value,
  words,
  start,
  end,
}: {
  value: string;
  words: string;
  start: number;
  end: number;
}) {
  const glued = GLUED_MARKS.includes(words.charAt(0)) || words.startsWith('\n');
  const before = glued ? trimEndSpaces(value.slice(0, start)) : value.slice(0, start);
  const after = words.endsWith('\n')
    ? trimStartSpaces(value.slice(end))
    : value.slice(end);
  const lead = !glued && before.length > 0 && !/\s$/.test(before) ? ' ' : '';
  const written = !glued && startsSentence(before) ? capitalizeFirst(words) : words;
  const spacedAfter =
    after.length === 0 || /\s$/.test(written) || /^[\s.,;:!?]/.test(after);
  return { before, text: `${lead}${written}${spacedAfter ? '' : ' '}`, after };
}

/**
 * Write a dictated (or suggested) phrase into `value` between `start` and `end` — the caret or
 * selection, the end of the text by default: one space before it unless the text before already
 * ends in whitespace, one after it when a word follows, and a capital first letter where a sentence
 * starts. A phrase that opens on a mark or a line break (a spoken "full stop", "new line") is
 * written straight after the words before it, the spaces between dropped. `maxLength` caps the
 * result (the phrase is cut, never the text already there).
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
  const words = trimSpaces(phrase);
  if (!words) return { value, caret: start };
  const { before, text, after } = placeWords({ value, words, start, end });
  let inserted = text;
  if (maxLength !== undefined) {
    const room = Math.max(0, maxLength - before.length - after.length);
    inserted = inserted.slice(0, room);
  }
  return {
    value: `${before}${inserted}${after}`,
    caret: before.length + inserted.length,
  };
}
