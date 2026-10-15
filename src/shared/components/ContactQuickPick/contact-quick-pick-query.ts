/*
 * What a contact search's text says about the person behind it (change-contact-quick-pick D8,
 * change-natural-contact-search D4): the quick add's start — the words fill Name, a number fills
 * Mobile, an Instagram handle fills Instagram — and the words of a name the typed text matched.
 */

/** A quick add's values: a name, a mobile's local digits and a handle (`''` for each one missing). */
export interface QuickAddDraft {
  name: string;
  /** At most ten digits, without `+91`. */
  phone: string;
  /** An Instagram handle as the contact editor keeps it: `@meera.iyer`. */
  instagram: string;
}

/** The longest name a contact takes (clinozy-be `first_name` + `last_name`, 60 each). */
export const QUICK_ADD_NAME_MAX = 60;

/** A quick add with nothing typed. */
export const EMPTY_QUICK_ADD_DRAFT: QuickAddDraft = {
  name: '',
  phone: '',
  instagram: '',
};

/** A record's number, not a person's: `C-12345`, `#2371`, `PT-0412`. */
const RECORD_NUMBER = /^(?:c-?|#|pt-?)\s*\d{1,9}$/i;
/** A run of a typed number: digits with the separators people type, maybe a leading `+`. */
const NUMBER_RUN = /\+?\d[\d\s().-]*/g;
/** A run counts as a mobile from 4 digits — the search's own rule for a number. */
const PHONE_MIN_DIGITS = 4;
/** Any letter, in any script. */
const LETTER = /\p{L}/u;
/** A handle's own characters, 1–30 (the contact editor's handle). */
const HANDLE = /^[a-z0-9._]{1,30}$/i;
/** What may come before a handle in a profile link someone pasted. */
const PROFILE_LINK_PREFIXES = ['https://', 'http://', 'www.'] as const;
/** The profile link's site. */
const PROFILE_SITE = 'instagram.com/';

/** An email — never a name; contacts keep none in the app (D5): something@somewhere.tld. */
function isEmailWord(word: string): boolean {
  const at = word.indexOf('@');
  return at > 0 && word.slice(at + 1).includes('.');
}

/** The handle a word names — `@meera.iyer`, `instagram.com/meera.iyer/` — or undefined. */
function handleOfWord(word: string): string | undefined {
  let rest = word;
  if (rest.startsWith('@')) rest = rest.slice(1);
  else {
    for (const prefix of PROFILE_LINK_PREFIXES) {
      if (rest.toLowerCase().startsWith(prefix)) rest = rest.slice(prefix.length);
    }
    if (!rest.toLowerCase().startsWith(PROFILE_SITE)) return undefined;
    rest = rest.slice(PROFILE_SITE.length).replace(/\/$/, '');
  }
  return HANDLE.test(rest) ? rest.toLowerCase() : undefined;
}

/** A typed number's local digits: no `+91` / `91` country code, no trunk `0`, at most ten. */
function localDigitsOf(run: string): string {
  let digits = run.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** The words of a search, the handle and the emails taken out. */
function wordsOf(query: string): { words: string[]; instagram: string } {
  let instagram = '';
  const words = query.split(/\s+/).filter((word) => {
    if (isEmailWord(word)) return false;
    const handle = handleOfWord(word);
    if (handle === undefined) return true;
    if (instagram === '') instagram = `@${handle}`;
    return false;
  });
  return { words, instagram };
}

/**
 * The quick add's start from what was typed, each value in the field it belongs to (D4): an
 * Instagram handle (`@x`, `instagram.com/x`) fills Instagram, the first number with 4+ digits
 * fills Mobile, the words left fill Name (none when no letter is left); an email is dropped (D5)
 * and a record number fills nothing — "Meera 98250 11241 @meera.iyer" → Meera · 9825011241 ·
 * @meera.iyer, "+91 98250-11241" → · 9825011241.
 */
export function quickAddDraftOf(typed: string): QuickAddDraft {
  const query = typed.trim();
  if (query === '' || RECORD_NUMBER.test(query)) return EMPTY_QUICK_ADD_DRAFT;
  const { words, instagram } = wordsOf(query);
  const text = words.join(' ');
  const run = [...text.matchAll(NUMBER_RUN)].find(
    ([match]) => match.replace(/\D/g, '').length >= PHONE_MIN_DIGITS,
  )?.[0];
  const phone = run ? localDigitsOf(run) : '';
  const rest = (run ? text.replace(run, ' ') : text).replace(/\s+/g, ' ').trim();
  const name = LETTER.test(rest) ? rest.slice(0, QUICK_ADD_NAME_MAX).trim() : '';
  return { name, phone, instagram };
}

/** One piece of a name: marked when a typed word matched it. */
export interface NamePiece {
  text: string;
  marked: boolean;
  /** Where the piece starts in the name — its stable key. */
  start: number;
}

/**
 * The name cut into pieces, every typed word marked wherever it is in it — case-insensitive,
 * overlapping matches merged (D9): "iyer meera" marks both words of "Meera Iyer". `null` when no
 * word of a name was typed (a number, a contact number, a handle) or none is in it.
 */
export function markWords(name: string, typed: string): NamePiece[] | null {
  const needles = quickAddDraftOf(typed)
    .name.toLocaleLowerCase()
    .split(' ')
    .filter((word) => word !== '');
  if (needles.length === 0) return null;
  const haystack = name.toLocaleLowerCase();
  const marked = new Array<boolean>(name.length).fill(false);
  for (const needle of needles) {
    for (
      let at = haystack.indexOf(needle);
      at >= 0;
      at = haystack.indexOf(needle, at + 1)
    ) {
      marked.fill(true, at, at + needle.length);
    }
  }
  if (!marked.includes(true)) return null;
  const pieces: NamePiece[] = [];
  for (let index = 0; index < name.length; index += 1) {
    const isMarked = marked[index] ?? false;
    const last = pieces.at(-1);
    if (last && last.marked === isMarked) last.text += name[index];
    else pieces.push({ text: name[index] ?? '', marked: isMarked, start: index });
  }
  return pieces;
}

/**
 * A Recent chip's short name (change-compact-contact-picker D6): the first word and the last
 * word's initial — "Kavya Shah" → "Kavya S.", "Dayaananda Namboothiri" → "Dayaananda N." — and a
 * one-word name whole. The chip still carries the whole name (its title and accessible name).
 */
export function railName(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0] ?? '';
  const last = words.length > 1 ? words.at(-1) : undefined;
  // The initial is the last word's first character, a whole code point (`Array.from`).
  const initial = last ? Array.from(last)[0] : undefined;
  return initial ? `${first} ${initial.toLocaleUpperCase()}.` : first;
}
