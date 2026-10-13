/**
 * Bidi marks in assertions (`src/lib/bidi-isolate.ts`): a data token inside a
 * sentence is wrapped in FSI…PDI (its own direction) or LRI…PDI (always left
 * to right). These build the expected text from literal marks — independent of
 * the helper under test — and strip them for checks of content and order.
 */

/** `text` as an FSI…PDI isolate — a name, a time or a label in its own direction. */
export const fsi = (text: string): string => `\u2068${text}\u2069`;

/** `text` as an LRI…PDI isolate — a phone or an id, always left to right. */
export const lri = (text: string): string => `\u2066${text}\u2069`;

/** The text as the reader sees it: the invisible isolate marks removed, the order kept. */
export const withoutBidiMarks = (text: string | null | undefined): string =>
  (text ?? '').replace(/[\u2066-\u2069]/g, '');
