import { createContext, useContext, useLayoutEffect } from 'react';

import type { DrawerContentProfile } from './record-drawer-width.ts';

/**
 * Set by the record drawer around its body: called by an item-rows table that
 * mounts inside it. Outside a drawer it is `null`.
 */
export const DrawerItemsContext = createContext<(() => void) | null>(null);

/**
 * Reports an item-rows table to the record drawer it sits in, so the drawer's
 * automatic width reads it through `resolveDrawerWidth`'s `hasItems` (840px,
 * H:3850) — one rule, fed by the field itself. A compact field (`wide`
 * false: the Mode · Amount rows) leaves the width alone. The report sticks
 * until the drawer closes, so folding the step away does not narrow it.
 *
 * A step that starts collapsed has not mounted its fields: a drawer whose items
 * table sits there declares it up front with `content.hasItems`.
 */
export function useDrawerItemsField(wide: boolean): void {
  const markItems = useContext(DrawerItemsContext);
  useLayoutEffect(() => {
    if (wide) markItems?.();
  }, [markItems, wide]);
}

/**
 * The drawer's profile once an items table has reported itself: `hasItems`
 * set, the rest as the screen declared it.
 */
export function withMountedItems(
  content: DrawerContentProfile | undefined,
  itemsMounted: boolean,
): DrawerContentProfile | undefined {
  if (!itemsMounted) return content;
  return { fieldCount: 0, ...content, hasItems: true };
}
