/*
 * Bidi isolation for data inside text — a Latin name, phone, id, time or
 * amount in a right-to-left sentence (or an Arabic name in an English one).
 * Unisolated, the Unicode bidi algorithm lends a token's neutral characters
 * (spaces, "+", ".", "−", "·") to the run around it: on a right-to-left page
 * "+91 98250 44120" reads "44120 98250 91+" and "Riya S." reads ".Riya S".
 *
 * An element isolates with its `dir` attribute — `dir="auto"` for free text,
 * `dir="ltr"` for phones and ids, which always read left to right — and, when
 * it sits on a line of its own, `[text-align:match-parent]` so it still aligns
 * with the page (the table cells' mechanism, L-53). A string isolates each data
 * token with these marks: FSI…PDI is the string form of `dir="auto"`, LRI…PDI
 * of `dir="ltr"`. Isolate the tokens, never the whole translated sentence — the
 * sentence keeps the page's direction. A container's `dir="auto"` takes the
 * first letter it meets, inside an isolate too, so it never goes on a line
 * whose translation may lead with a token ("{{name}} · …" in Arabic).
 */

/** U+2068 FIRST STRONG ISOLATE — the token takes the direction of its first letter. */
const FIRST_STRONG_ISOLATE = '\u2068';
/** U+2066 LEFT-TO-RIGHT ISOLATE — the token always reads left to right. */
const LEFT_TO_RIGHT_ISOLATE = '\u2066';
/** U+2069 POP DIRECTIONAL ISOLATE — closes either isolate. */
const POP_DIRECTIONAL_ISOLATE = '\u2069';

/** i18next's own options: never interpolated, so never wrapped. */
const I18N_OPTION_KEYS: ReadonlySet<string> = new Set([
  'ns',
  'lng',
  'context',
  'defaultValue',
]);

/**
 * `text` as one bidi isolate: in its own direction (`auto` — a name, a
 * translated label) or always left to right (`ltr` — a phone, an id). Empty
 * text stays empty, so an absent part adds no marks.
 */
export function isolateText(text: string, direction: 'auto' | 'ltr' = 'auto'): string {
  if (text === '') return text;
  const open = direction === 'ltr' ? LEFT_TO_RIGHT_ISOLATE : FIRST_STRONG_ISOLATE;
  return `${open}${text}${POP_DIRECTIONAL_ISOLATE}`;
}

/**
 * A `t()` values object with every string value isolated — the data tokens of
 * a translated sentence. Numbers (a plural's `count`) and i18next's own options
 * (`ns`, `context` …) pass through untouched.
 */
export function isolateValues<T extends Readonly<Record<string, unknown>>>(values: T): T {
  const entries = Object.entries(values).map(([key, value]) => [
    key,
    typeof value === 'string' && !I18N_OPTION_KEYS.has(key) ? isolateText(value) : value,
  ]);
  return Object.fromEntries(entries) as T;
}

/**
 * The design's " · " join with each part isolated — "#3508 · +91 98250 44120"
 * keeps every part whole on a right-to-left page. Empty parts drop out.
 */
export function isolateJoin(
  parts: readonly (string | null | undefined | false)[],
  separator = ' · ',
): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => isolateText(part))
    .join(separator);
}
