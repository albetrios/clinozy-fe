import type { I18nLocale } from '@/lib/i18n/locales.ts';
import { type ModuleLoader, onceAsync } from '@/lib/lazy-module.ts';

import type { ClinicalField } from '../../../shared/patient-clinical.ts';

/** The lists a smart note files words under (H:4918 `SNK`: no Later). */
type SmartNoteField = Exclude<ClinicalField, 'futureSuggestions'>;

/**
 * What the smart note recognises, per list (H:3702 `SN_DICT`): one key per
 * word of the prototype's dictionary — the same keys in every language.
 */
export const SMART_NOTE_KEYS = {
  complaints: [
    'hairFall',
    'itching',
    'tan',
    'tanning',
    'acne',
    'pimples',
    'pigmentation',
    'darkSpots',
    'redness',
    'dandruff',
    'dryness',
    'pain',
  ],
  diagnosis: [
    'melasma',
    'alopecia',
    'pih',
    'acneVulgaris',
    'dermatitis',
    'seborrheic',
    'fungalInfection',
    'vitiligo',
  ],
  treatmentSuggestions: ['peel', 'lhr', 'hydrafacial', 'prp', 'laser', 'microneedling'],
} as const satisfies Readonly<Record<SmartNoteField, readonly string[]>>;

/** The lists in the order their chips are filed. */
const SMART_NOTE_FIELDS = Object.keys(SMART_NOTE_KEYS) as SmartNoteField[];

/** One concept's words in a language — the first is how its chip reads. */
type SmartNoteWords = readonly [string, ...string[]];

/**
 * One language's smart-note words (`smart-note-words/<locale>.ts`): every
 * key of {@link SMART_NOTE_KEYS} with the words that name it.
 */
export type SmartNoteDictionary = {
  readonly [F in SmartNoteField]: Readonly<
    Record<(typeof SMART_NOTE_KEYS)[F][number], SmartNoteWords>
  >;
} & {
  /**
   * English words this language uses for something else — "tan" is Spanish
   * for "so" — which the note does not read under it.
   */
  readonly ignoreEnglish?: readonly string[];
};

/** What a note is read with: the UI language's words, then English (none under English). */
export interface SmartNoteReading {
  own: SmartNoteDictionary;
  english?: SmartNoteDictionary;
}

type DictionaryLoader = ModuleLoader<SmartNoteDictionary>;

/**
 * Each language's words, fetched on first use and never in the entry chunk —
 * one explicit import per locale, as the namespaces load
 * (`i18n-resources.multi.ts`), never a template glob.
 */
const DICTIONARY_LOADERS: Readonly<Record<I18nLocale, DictionaryLoader>> = {
  en: onceAsync(() => import('./smart-note-words/en.ts').then((module) => module.WORDS)),
  es: onceAsync(() => import('./smart-note-words/es.ts').then((module) => module.WORDS)),
  zh: onceAsync(() => import('./smart-note-words/zh.ts').then((module) => module.WORDS)),
  fr: onceAsync(() => import('./smart-note-words/fr.ts').then((module) => module.WORDS)),
  de: onceAsync(() => import('./smart-note-words/de.ts').then((module) => module.WORDS)),
  ja: onceAsync(() => import('./smart-note-words/ja.ts').then((module) => module.WORDS)),
  pt: onceAsync(() => import('./smart-note-words/pt.ts').then((module) => module.WORDS)),
  ar: onceAsync(() => import('./smart-note-words/ar.ts').then((module) => module.WORDS)),
  hi: onceAsync(() => import('./smart-note-words/hi.ts').then((module) => module.WORDS)),
  ko: onceAsync(() => import('./smart-note-words/ko.ts').then((module) => module.WORDS)),
  it: onceAsync(() => import('./smart-note-words/it.ts').then((module) => module.WORDS)),
};

/**
 * The words a note is read with under `locale` — its own, and the English a
 * clinician may type in any language — each fetched once; a failed fetch is
 * tried again on the next call.
 */
export async function loadSmartNoteReading(
  locale: I18nLocale,
): Promise<SmartNoteReading> {
  const [own, english] = await Promise.all([
    DICTIONARY_LOADERS[locale](),
    DICTIONARY_LOADERS.en(),
  ]);
  return own === english ? { own } : { own, english };
}

/** Latin accents, once NFKD has split them off their letters (é → e + ◌́). */
const LATIN_ACCENTS = /[̀-ͯ]/g;
/** Arabic tatweel, short vowels, shadda, sukun and the hamza / madda NFKD splits off (أ → ا + ◌ٔ). */
const ARABIC_MARKS = /ـ|[ً-ٟ]|ٰ/g;
/** The Devanagari nukta (ड़ → ड + ◌़) — often left out when typing. */
const NUKTA = /़/g;
/** Invisible format characters — joiners, direction marks, soft hyphens. */
const FORMAT = /\p{Cf}/gu;

/**
 * A text as the note compares it — case and accents folded (NFKD; "Rötung"
 * reads as "rotung", full-width "ＰＲＰ" as "prp"), Arabic vowel marks,
 * hamza seats, ى and ة and the Devanagari nukta folded the same way, runs
 * of white space as one.
 */
export function foldSmartNoteText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(LATIN_ACCENTS, '')
    .replace(ARABIC_MARKS, '')
    .replace(NUKTA, '')
    .replace(FORMAT, '')
    .normalize('NFC')
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .replaceAll('ٱ', 'ا')
    .replaceAll('ى', 'ي')
    .replaceAll('ة', 'ه')
    .replace(/\s+/g, ' ');
}

/** Scripts written without spaces between words: a word of theirs is found anywhere. */
const SPACELESS =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** A word of at most this many letters must stand alone — "tan" is not the "tan" of "important". */
const SHORT_WORD = 3;
/** The scripts whose letters would carry a short word on into a longer one. */
const WORD_SCRIPTS = [
  /\p{Script=Latin}/u,
  /\p{Script=Arabic}/u,
  /\p{Script=Devanagari}/u,
] as const;
const LETTER_OR_MARK = /[\p{L}\p{M}]/u;

/** Whether `char` is a letter of `word`'s own script — one that would make it a longer word. */
function continues(word: string, char: string | undefined): boolean {
  if (char === undefined || !LETTER_OR_MARK.test(char)) return false;
  const script = WORD_SCRIPTS.find((pattern) => pattern.test(word));
  return script ? script.test(char) : true;
}

/**
 * Whether the folded `text` holds the folded `word`: anywhere (the
 * prototype's `includes` — "hyperpigmentation", "Gesichtsakne", "والحكة"),
 * but a short word must stand alone — Japanese "PRPを" still does.
 */
function holds(text: string, word: string): boolean {
  const letters = [...word].filter((char) => /\p{L}/u.test(char)).length;
  if (SPACELESS.test(word) || letters > SHORT_WORD) return text.includes(word);
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    if (!(continues(word, text[at - 1]) || continues(word, text[at + word.length]))) {
      return true;
    }
  }
  return false;
}

/** The chip a dictionary files for one key when the note names it, else `null`. */
function labelIn(
  text: string,
  dictionary: SmartNoteDictionary,
  field: SmartNoteField,
  key: string,
  ignored?: ReadonlySet<string>,
): string | null {
  const words =
    (dictionary[field] as Readonly<Record<string, readonly string[]>>)[key] ?? [];
  const named = words.some((word) => {
    const folded = foldSmartNoteText(word);
    return !ignored?.has(folded) && holds(text, folded);
  });
  return named ? (words[0] ?? null) : null;
}

/** The shortest note the smart note reads (H:4917 `length < 3`)… */
const SMART_NOTE_MIN = 3;
/** …and in a script without spaces, where two characters are a word ("脱发"). */
const SMART_NOTE_MIN_SPACELESS = 2;

/** What a smart note recognised: the chips for the clinical lists, and the medicines. */
export interface SmartNoteFindings {
  chips: { field: ClinicalField; text: string }[];
  /** The catalogue's medicines whose name's first word the note holds. */
  medicines: string[];
}

/**
 * Read a smart note (H:4917) with the UI language's words, then English:
 * each key it names becomes one chip under its list, reading as the
 * matched language's first word — "hair fall 2 months, suggest PRP" →
 * Complaints "Hair fall", Suggested "PRP"; "Haarausfall" → "Haarausfall" —
 * and each catalogue medicine whose name's first word it holds ("flubolt" →
 * Flubolt 400). Under three letters (two without spaces) it reads nothing.
 */
export function parseSmartNote(
  note: string,
  medicineNames: readonly string[],
  reading: SmartNoteReading,
): SmartNoteFindings {
  const text = foldSmartNoteText(note).trim();
  const min = SPACELESS.test(text) ? SMART_NOTE_MIN_SPACELESS : SMART_NOTE_MIN;
  if ([...text].length < min) return { chips: [], medicines: [] };
  const ignored = new Set((reading.own.ignoreEnglish ?? []).map(foldSmartNoteText));
  const chips: SmartNoteFindings['chips'] = [];
  for (const field of SMART_NOTE_FIELDS) {
    for (const key of SMART_NOTE_KEYS[field]) {
      const label =
        labelIn(text, reading.own, field, key) ??
        (reading.english ? labelIn(text, reading.english, field, key, ignored) : null);
      if (label && !chips.some((chip) => chip.field === field && chip.text === label)) {
        chips.push({ field, text: label });
      }
    }
  }
  const medicines = medicineNames.filter((name) => {
    const [first = ''] = foldSmartNoteText(name).trim().split(' ');
    return first !== '' && holds(text, first);
  });
  return { chips, medicines };
}
