/**
 * Composer drafts (KICKOFF §3.5 Drafts; H:5645, `_patterns.md:157`): the
 * unsent text of each thread, kept while the user moves between people and
 * restored on return — in memory only, never across a reload. A module-level
 * map, not a store: nothing renders from it, the composer reads it when it
 * opens on a person and writes through on every keystroke.
 */
const drafts = new Map<string, string>();

/** A thread's unsent text ('' when there is none). */
export function readDraft(personKey: string): string {
  return drafts.get(personKey) ?? '';
}

/** Keep a thread's unsent text; empty text forgets it. */
export function writeDraft(personKey: string, text: string): void {
  if (text) drafts.set(personKey, text);
  else drafts.delete(personKey);
}

/** Forget every draft (tests). */
export function clearDrafts(): void {
  drafts.clear();
}
