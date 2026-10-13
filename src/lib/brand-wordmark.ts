/** The wordmark's three parts: the text before the ring, whether there is one, the rest. */
export interface WordmarkParts {
  head: string;
  ring: boolean;
  tail: string;
}

/**
 * How the wordmark draws a product name (`shell.md:18`; H:518, H:525): in lower
 * case, its first "o" replaced by a ring with a `brand-mark-strong` centre. A name
 * without an "o" is set as plain text.
 *
 * One rule for both drawings of it — `ProductWordmark` in React and the boot
 * splash in `index.html`, which `plugins/product-identity-html.ts` fills from the
 * product identity — so a rebrand changes the two together.
 */
export function wordmarkParts(name: string): WordmarkParts {
  const word = name.toLowerCase();
  const at = word.indexOf('o');
  if (at < 0) return { head: word, ring: false, tail: '' };
  return { head: word.slice(0, at), ring: true, tail: word.slice(at + 1) };
}
