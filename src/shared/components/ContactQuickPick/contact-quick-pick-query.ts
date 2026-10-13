/*
 * What a contact search's text says about the person behind it (change-contact-quick-pick D8):
 * the quick add's start — the words fill Name, a number fills Mobile — and the part of a name
 * the typed text matched.
 */

/** A quick add's values: a name and a mobile's local digits (`''` when none). */
export interface QuickAddDraft {
  name: string;
  /** At most ten digits, without `+91`. */
  phone: string;
}

/** The longest name a contact takes (clinozy-be `first_name` + `last_name`, 60 each). */
export const QUICK_ADD_NAME_MAX = 60;

/** A record's number, not a person's: `C-12345`, `#2371`, `PT-0412`. */
const RECORD_NUMBER = /^(?:c-?|#|pt-?)\s*\d{1,9}$/i;
/** A run of a typed number: digits with the separators people type, maybe a leading `+`. */
const NUMBER_RUN = /\+?\d[\d\s().-]*/g;
/** A run counts as a mobile from 4 digits — the search's own rule for a number. */
const PHONE_MIN_DIGITS = 4;
/** Any letter, in any script. */
const LETTER = /\p{L}/u;

/** A typed number's local digits: no `+91` / `91` country code, no trunk `0`, at most ten. */
function localDigitsOf(run: string): string {
  let digits = run.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * The quick add's start from what was typed: the first number with 4+ digits fills the
 * mobile, the words left fill the name (none when no letter is left); a record number fills
 * neither — "Meera 98250 11241" → Meera · 9825011241, "+91 98250-11241" → · 9825011241.
 */
export function quickAddDraftOf(typed: string): QuickAddDraft {
  const query = typed.trim();
  if (query === '' || RECORD_NUMBER.test(query)) return { name: '', phone: '' };
  const run = [...query.matchAll(NUMBER_RUN)].find(
    ([match]) => match.replace(/\D/g, '').length >= PHONE_MIN_DIGITS,
  )?.[0];
  const phone = run ? localDigitsOf(run) : '';
  const rest = (run ? query.replace(run, ' ') : query).replace(/\s+/g, ' ').trim();
  const name = LETTER.test(rest) ? rest.slice(0, QUICK_ADD_NAME_MAX).trim() : '';
  return { name, phone };
}

/** A name cut around the part the search matched. */
export interface MarkedName {
  before: string;
  match: string;
  after: string;
}

/**
 * Where the typed words sit in a name, case-insensitively — the hit's highlight — or `null`
 * when they are not in it as typed (a number, a contact number, an email or a handle matched).
 */
export function markMatch(name: string, typed: string): MarkedName | null {
  const needle = quickAddDraftOf(typed).name;
  if (needle === '') return null;
  const start = name.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (start < 0) return null;
  const end = start + needle.length;
  return {
    before: name.slice(0, start),
    match: name.slice(start, end),
    after: name.slice(end),
  };
}
