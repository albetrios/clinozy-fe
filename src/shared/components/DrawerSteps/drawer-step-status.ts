/** Where a step stands: drives its number circle, its card and its hint. */
export type DrawerStepStatus = 'open' | 'missing' | 'done' | 'later';

/**
 * A step's status against the reference step — the open one, or the last one
 * opened while every card is collapsed (H:3840–3841): open; missing a required
 * field ("!", only when not open); done (at or before the reference, "✓");
 * otherwise later.
 */
export function drawerStepStatus(
  index: number,
  openIndex: number,
  referenceIndex: number,
  missingCount: number,
): DrawerStepStatus {
  if (index === openIndex) return 'open';
  if (missingCount > 0) return 'missing';
  return index <= referenceIndex ? 'done' : 'later';
}
