import {
  capitalizeFirst,
  trimSpaces,
} from '@/shared/components/VoiceInputButton/index.ts';

/** A mark said as words: punctuation or a line break. */
export type SpokenMark =
  'period' | 'comma' | 'question' | 'exclamation' | 'colon' | 'newLine' | 'newParagraph';

/** One mark's spoken words and what it writes. */
export interface SpokenMarkWords {
  mark: SpokenMark;
  /** What is said for it, in the recognition language ("full stop", "period"). */
  words: readonly string[];
  /** What it writes (".", "。", a line break). */
  text: string;
}

/** The commands a voice field hears, in the recognition language. */
export interface VoiceVocabulary {
  marks: readonly SpokenMarkWords[];
  /** The words that take back what was just said ("scratch that"). */
  scratch: readonly string[];
}

/** What a settled phrase becomes once its commands are read. */
export interface SpokenPhrase {
  /** The words to write, the marks in place; empty when nothing is left to write. */
  text: string;
  /** How many phrases written before this one to take back (each lone "scratch that"). */
  undo: number;
}

/** Marks after which the next word starts a sentence. */
const SENTENCE_MARKS: ReadonlySet<SpokenMark> = new Set([
  'period',
  'question',
  'exclamation',
  'newLine',
  'newParagraph',
]);

/** Marks that break the line — a single-line field has no lines, so it ignores them. */
const LINE_MARKS: ReadonlySet<SpokenMark> = new Set(['newLine', 'newParagraph']);

/** Scripts written without spaces between words: a command there may touch the words around it. */
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** Text that ends (or starts) in an unspaced script or its full-width marks: no space goes there. */
const UNSPACED_EDGE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}。，、？！：]/u;

type Command = { kind: 'scratch' } | { kind: 'mark'; mark: SpokenMark; text: string };

function normalizeWords(words: string): string {
  return words.toLocaleLowerCase().split(/\s+/u).filter(Boolean).join(' ');
}

function escapeForPattern(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/**
 * One command word as a pattern: whole words only (a letter, a vowel sign or a digit on either side
 * is another word), except in a script without spaces.
 */
function commandPattern(words: string): string {
  const pattern = normalizeWords(words)
    .split(' ')
    .map(escapeForPattern)
    .join(String.raw`\s+`);
  return UNSPACED_SCRIPT.test(words)
    ? pattern
    : String.raw`(?<![\p{L}\p{M}\p{N}])${pattern}(?![\p{L}\p{M}\p{N}])`;
}

/** Every command word, longest first (so "new paragraph" wins over "new"), and what each does. */
function readVocabulary(vocabulary: VoiceVocabulary) {
  const table = new Map<string, Command>();
  for (const entry of vocabulary.marks) {
    for (const words of entry.words) {
      table.set(normalizeWords(words), {
        kind: 'mark',
        mark: entry.mark,
        text: entry.text,
      });
    }
  }
  for (const words of vocabulary.scratch)
    table.set(normalizeWords(words), { kind: 'scratch' });
  table.delete('');
  const alternatives = [...table.keys()]
    .sort((left, right) => right.length - left.length)
    .map(commandPattern);
  if (alternatives.length === 0) return { table, pattern: null };
  // Built from the app's own locale copy, each word escaped: nothing typed or said reaches it.
  // eslint-disable-next-line security/detect-non-literal-regexp -- escaped words from our locale files
  const pattern = new RegExp(alternatives.join('|'), 'giu');
  return { table, pattern };
}

/** `words` after `text`, a space between unless either side is unspaced script or a line break. */
function joinWords({
  text,
  words,
  capitalize,
}: {
  text: string;
  words: string;
  capitalize: boolean;
}): string {
  const next = words.trim();
  if (!next) return text;
  const written = capitalize ? capitalizeFirst(next) : next;
  const glued =
    text === '' ||
    /\s$/u.test(text) ||
    UNSPACED_EDGE.test(text.charAt(text.length - 1)) ||
    UNSPACED_EDGE.test(written.charAt(0));
  return glued ? `${text}${written}` : `${text} ${written}`;
}

/**
 * Read the commands in a settled phrase: a mark said as words is written as the mark ("mild
 * redness full stop avoid sun" → "mild redness. Avoid sun"), a line break only in a field of
 * several lines; "scratch that" drops the words said before it in the same phrase, or — said on its
 * own — takes back the phrase written before. Words match whole and in any case; in Chinese and
 * Japanese, which have no spaces, anywhere.
 *
 * @param input.phrase - The settled phrase as the browser heard it.
 * @param input.vocabulary - The commands in the recognition language.
 * @param input.multiline - The field has lines: "new line" breaks one.
 * @returns The words to write and how many earlier phrases to take back.
 */
export function readSpokenPhrase({
  phrase,
  vocabulary,
  multiline,
}: {
  phrase: string;
  vocabulary: VoiceVocabulary;
  multiline: boolean;
}): SpokenPhrase {
  const { table, pattern } = readVocabulary(vocabulary);
  if (!pattern) return { text: phrase.trim(), undo: 0 };
  let text = '';
  let undo = 0;
  let capitalize = false;
  let cursor = 0;
  for (const match of phrase.matchAll(pattern)) {
    text = joinWords({ text, words: phrase.slice(cursor, match.index), capitalize });
    cursor = match.index + match[0].length;
    const command = table.get(normalizeWords(match[0]));
    if (command?.kind === 'scratch') {
      if (text.trim() === '') undo += 1;
      text = '';
      capitalize = false;
    } else if (command && (multiline || !LINE_MARKS.has(command.mark))) {
      text = `${trimSpaces(text)}${command.text}`;
      capitalize = SENTENCE_MARKS.has(command.mark);
    }
  }
  text = joinWords({ text, words: phrase.slice(cursor), capitalize });
  return { text: trimSpaces(text), undo };
}
