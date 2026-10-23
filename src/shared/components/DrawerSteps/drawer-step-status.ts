import type { DrawerPeekItem } from './drawer-step-peek.tsx';

/** Where a step stands: drives its number circle, its card and its hint. */
export type DrawerStepStatus = 'open' | 'missing' | 'done' | 'later';

/** What a step's status is read from. */
export interface DrawerStepStatusInput {
  /** The step is the open one. */
  open: boolean;
  /** How many of its required fields are still empty. */
  missingCount: number;
  /**
   * How many rules its filled fields break — the ones its save checks (a mobile that is not
   * ten digits, a purchase with no item).
   */
  problemCount?: number;
  /** It holds something: a filled value in its peek, or its `complete` flag. */
  filled: boolean;
  /** The user has been to it — opened it at least once since the drawer opened. */
  reached: boolean;
  /** A save was tried: an empty required field is flagged on every step. */
  revealMissing?: boolean;
  /**
   * The step's own say on whether it is complete, over what it holds and over
   * having been opened — the contact editor's identity, complete only once named.
   */
  complete?: boolean;
}

/**
 * A step's status — the same rule in every drawer: open; missing a required
 * field or breaking a rule its save checks ("!", only once the step was reached
 * or a save was tried — a step the user has not got to yet is never red); done
 * ("✓", it holds something or was reached, nothing required is empty and
 * nothing filled breaks a rule — a saved record's steps, a step a default or a
 * Quick fill filled — unless the step says it is not complete); otherwise later
 * (its grey number).
 */
export function drawerStepStatus({
  open,
  missingCount,
  problemCount = 0,
  filled,
  reached,
  revealMissing = false,
  complete,
}: DrawerStepStatusInput): DrawerStepStatus {
  if (open) return 'open';
  if (missingCount > 0 || problemCount > 0) {
    return reached || revealMissing ? 'missing' : 'later';
  }
  if (complete !== undefined) return complete ? 'done' : 'later';
  return filled || reached ? 'done' : 'later';
}

/** Whether a peek holds a filled value — a value, a pick or an item row. */
export function peekHasValue(peek: readonly DrawerPeekItem[] | undefined): boolean {
  return (peek ?? []).some((item) => {
    if (item.kind === 'value') return Boolean(item.value);
    if (item.kind === 'multi') return item.values.length > 0;
    return item.names.length > 0;
  });
}
