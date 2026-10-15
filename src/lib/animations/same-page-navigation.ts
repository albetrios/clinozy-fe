/**
 * A move within the same room is no page change (`feat-payment-celebration` D13): a room's own
 * tabs and the patient file's sections mark the click that moves, and {@link PageTransition}
 * takes the mark as the page commits — so the header, rail and tab track that stay on screen do
 * not rise again. Only the next commit may take it, and only for a short while: a mark a
 * navigation never used (a refused one) runs out.
 */
let markedAt = Number.NEGATIVE_INFINITY;

/** How long a mark waits for its page to commit — the in-app pending policy's 3s, at most. */
const MARK_MS = 3000;

/** A same-room link calls this as it is clicked (not for the tab already showing). */
export function markSamePageNavigation(): void {
  markedAt = performance.now();
}

/** Whether the page now committing was reached by a same-room move — read once. */
export function takeSamePageNavigation(): boolean {
  const marked = performance.now() - markedAt < MARK_MS;
  markedAt = Number.NEGATIVE_INFINITY;
  return marked;
}
