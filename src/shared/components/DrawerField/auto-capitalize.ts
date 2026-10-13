/** Input types whose value is prose — anything else (tel, email, number, url…) is left alone. */
const TEXT_TYPES = new Set(['text', 'search', '']);

/** Input modes that announce a number, a phone or an email (H:4518). */
const EXEMPT_INPUT_MODES = /tel|email|numeric|decimal/;

/**
 * Words in a label, aria-label or placeholder that name a field which is not
 * a name (H:4518). English only — the prototype's list; in other languages
 * `type`, `inputMode` and the `capitalize` opt-out carry the decision.
 */
const EXEMPT_LABEL = /instagram|mobile|phone|email|@|\+91|handle|search|jump/i;

/** The words that name a field: its aria-label, its placeholder and its labels. */
function fieldNames(target: HTMLInputElement | HTMLTextAreaElement): string {
  const labels = target.labels
    ? [...target.labels].map((label) => label.textContent)
    : [];
  return [
    target.getAttribute('aria-label'),
    target.getAttribute('placeholder'),
    ...labels,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Whether a field's first letter is capitalised as typed (KICKOFF §6.0 Inputs;
 * H:4515–4521): a name, a title, a note — never a phone, an email, a number, a
 * handle, a search or a message.
 */
export function capitalizesFirstLetter(
  target: HTMLInputElement | HTMLTextAreaElement,
): boolean {
  if (
    target instanceof HTMLInputElement &&
    !TEXT_TYPES.has((target.getAttribute('type') ?? '').toLowerCase())
  ) {
    return false;
  }
  if (EXEMPT_INPUT_MODES.test(target.getAttribute('inputmode') ?? '')) return false;
  const names = fieldNames(target);
  if (target instanceof HTMLTextAreaElement && /message/i.test(names)) return false;
  return !EXEMPT_LABEL.test(names);
}

/**
 * Capitalise a field's first letter in place, keeping the caret where it was —
 * unless the field is exempt, or its value starts with "@" (a handle).
 */
export function autoCapitalizeFirstLetter(
  target: HTMLInputElement | HTMLTextAreaElement,
): void {
  const { value } = target;
  if (!value || value.startsWith('@') || !capitalizesFirstLetter(target)) return;
  const first = value.charAt(0);
  const upper = first.toLocaleUpperCase('en-IN');
  if (first === upper) return;
  const { selectionStart, selectionEnd } = target;
  target.value = upper + value.slice(1);
  if (selectionStart !== null && selectionEnd !== null) {
    target.setSelectionRange(selectionStart, selectionEnd);
  }
}
