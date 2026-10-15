import { type MakeRouteMatchUnion, useMatches } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';

import { cn } from '@/lib/utils.ts';

import { riseChangedPart } from './rise-changed-part.ts';
import { takeSamePageNavigation } from './same-page-navigation.ts';
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

/** Splits a room from its page in {@link pageAt}'s string — no path holds a newline. */
const ROOM_SEPARATOR = '\n';

/**
 * Where the matches stand, as one string (a stable selection): "1" while the
 * deepest match is a URL-driven dialog route (`staticData.dialog`, D24), else
 * "0" — then the path of the room it is in (the deepest `staticData.room`
 * match, the patient file; empty outside one), a newline, and the path of the
 * deepest match that is a page.
 */
function pageAt(matches: readonly MakeRouteMatchUnion[]): string {
  const dialog = matches.at(-1)?.staticData.dialog === true;
  const page = matches.filter((match) => match.staticData.dialog !== true).at(-1);
  const room = matches.filter((match) => match.staticData.room === true).at(-1);
  return `${dialog ? '1' : '0'}${room?.pathname ?? ''}${ROOM_SEPARATOR}${page?.pathname ?? ''}`;
}

/**
 * The page the wrapper shows — the transition's replay signal — and the room it
 * sits in. A dialog route renders nothing of its own: the page under it opens
 * the drawer and stays mounted, so while one is open the key holds the page
 * that was showing — opening, switching and closing a dialog is no page change,
 * and the list never rises again under the drawer's backdrop. Read from the
 * matches, so it moves with the screen they render, not before it.
 */
function usePageKey(): { page: string; room: string } {
  const at = useMatches({ select: pageAt });
  const dialog = at.startsWith('1');
  const now = at.slice(1);
  const [shown, setShown] = useState(now);
  const key = dialog ? shown : now;
  // Storing what the previous render showed (react.dev: "you might not need an effect").
  if (key !== shown) setShown(key);
  const split = key.indexOf(ROOM_SEPARATOR);
  return { room: key.slice(0, split), page: key.slice(split + 1) };
}

/**
 * Wraps the route `<Outlet />` and plays a single, subtle fade + rise whenever
 * the page changes — not when a dialog route opens over it, nor on a move within
 * the same room (a room tab's mark, {@link takeSamePageNavigation}; or a `staticData.room`
 * layout, the patient file's sections), where only the part that changed rises
 * ({@link riseChangedPart}). Uses
 * transform-only `route-rise` (no opacity fade) so copy stays visible if
 * animation is skipped or reduced-motion overrides duration.
 *
 * The animation restarts on the SAME element — see {@link useReplayedAnimation}
 * for why a `key` is the wrong tool and what it used to cost here (SHELL-6).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const { page, room } = usePageKey();
  const ref = useRef<HTMLDivElement>(null);
  const roomShown = useRef(room);

  // A room's own tab or another section of the patient file is no new page: what stays on
  // screen stays still, and only the part that changed rises.
  useReplayedAnimation(ref, ROUTE_ANIMATION_CLASS, page, () => {
    const marked = takeSamePageNavigation();
    const sameRoom = room !== '' && room === roomShown.current;
    roomShown.current = room;
    if (!marked && !sameRoom) return true;
    if (ref.current) riseChangedPart(ref.current);
    return false;
  });

  return (
    <div ref={ref} data-route={page} className={cn('text-foreground', className)}>
      {children}
    </div>
  );
}
