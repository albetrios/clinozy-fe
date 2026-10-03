/**
 * Whether the user is mid-edit — the one question every "reload the app now"
 * affordance has to answer before it acts.
 *
 * @remarks
 * Extracted from `core/version/check.ts` so the deferred version-check reload
 * and the stale-chunk recovery in `core/version/stale-chunk-recovery.ts` share
 * one definition of "don't yank the page out from under them". A pure DOM read;
 * no listeners, no state.
 */

/** Editable roles a reload would destroy in-flight input for. */
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** A `contenteditable` host — `contenteditable` with no value means `"true"`. */
const CONTENT_EDITABLE_SELECTOR = '[contenteditable=""],[contenteditable="true"]';

/**
 * True when focus is in an editable field — reloading would lose what they're typing.
 *
 * @remarks
 * Covers the three editable form elements plus anything `contenteditable`
 * (rich-text surfaces). Returns false when nothing has focus, which is the
 * common case and the one where reloading is safe.
 *
 * `isContentEditable` is the computed, inherited answer and therefore the right
 * one — but not every DOM implementation exposes it (happy-dom leaves it
 * `undefined`, which the previous `|| el.isContentEditable` form leaked out of a
 * `: boolean` function). Comparing to `true` keeps the return honest, and
 * `closest()` on the declared attribute covers the host and its descendants
 * wherever the property is missing.
 */
export function isEditableElementFocused(): boolean {
  return isEditableTarget(document.activeElement);
}

/**
 * True when an event's target is an editable field — the same test as
 * {@link isEditableElementFocused}, for the element a key or input event went
 * to: its keys are typing, never a shortcut.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return (
    target.isContentEditable === true ||
    target.closest(CONTENT_EDITABLE_SELECTOR) !== null
  );
}
