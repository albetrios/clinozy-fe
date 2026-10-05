import { type MakeRouteMatchUnion, useMatches } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';

import { cn } from '@/lib/utils.ts';

import { useReplayedAnimation } from './useReplayedAnimation.ts';

interface PageTransitionProps {
  children: ReactNode;
  /**
   * Extra classes for the wrapper — a flush room's main passes a bounded flex
   * column, so the room's own list scrolls inside it (its header stays).
   */
  className?: string;
}

/** The keyframe class. Added imperatively so React never fights over it. */
const ROUTE_ANIMATION_CLASS = 'animate-fade-in-up';

/**
 * Where the matches stand, as one string (a stable selection): "1" while the
 * deepest match is a URL-driven dialog route (`staticData.dialog`, D24), else
 * "0" — then the path of the deepest match that is a page.
 */
function pageAt(matches: readonly MakeRouteMatchUnion[]): string {
  const dialog = matches.at(-1)?.staticData.dialog === true;
  const page = matches.filter((match) => match.staticData.dialog !== true).at(-1);
  return `${dialog ? '1' : '0'}${page?.pathname ?? ''}`;
}

/**
 * The page the wrapper shows — the transition's replay signal. A dialog route
 * renders nothing of its own: the page under it opens the drawer and stays
 * mounted, so while one is open the key holds the page that was showing —
 * opening, switching and closing a dialog is no page change, and the list
 * never rises again under the drawer's backdrop. Read from the matches, so it
 * moves with the screen they render, not before it.
 */
function usePageKey(): string {
  const at = useMatches({ select: pageAt });
  const dialog = at.startsWith('1');
  const path = at.slice(1);
  const [shown, setShown] = useState(path);
  const key = dialog ? shown : path;
  // Storing what the previous render showed (react.dev: "you might not need an effect").
  if (key !== shown) setShown(key);
  return key;
}

/**
 * Wraps the route `<Outlet />` and plays a single, subtle fade + rise whenever
 * the page changes — not when a dialog route opens over it. Uses
 * transform-only `route-rise` (no opacity fade) so copy stays visible if
 * animation is skipped or reduced-motion overrides duration.
 *
 * The animation restarts on the SAME element — see {@link useReplayedAnimation}
 * for why a `key` is the wrong tool and what it used to cost here (SHELL-6).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const page = usePageKey();
  const ref = useRef<HTMLDivElement>(null);

  useReplayedAnimation(ref, ROUTE_ANIMATION_CLASS, page);

  return (
    <div ref={ref} data-route={page} className={cn('text-foreground', className)}>
      {children}
    </div>
  );
}
