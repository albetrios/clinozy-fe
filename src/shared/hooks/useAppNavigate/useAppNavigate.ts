import { type UseNavigateResult, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';

import { crossRoomNavigation } from '@/shared/app/app-referrer.ts';

/** What the router's own `navigate` takes — a cross-room navigation's masked form. */
type RouterNavigateOptions = Parameters<ReturnType<typeof useRouter>['navigate']>[0];

/**
 * `useNavigate()` for the clinic's screens, with one difference (KICKOFF §4,
 * A-P1): a drawer another room owns — the Invoice drawer, Receive payment, the
 * appointment drawers, New sale — opened with a `from` naming another room
 * opens over that room. The page the member is on stays the router's route —
 * its guards keep running, it stays mounted, its search and scroll kept —
 * with the drawer named in its search, and the URL bar shows the drawer's own
 * route (a route mask), so the link to share is the drawer's. Every other
 * navigation goes as given.
 */
export function useAppNavigate(): UseNavigateResult<string> {
  const router = useRouter();
  const navigate = useCallback(
    (options: RouterNavigateOptions) => {
      const over = crossRoomNavigation(
        router.buildLocation(options),
        router.state.location,
      );
      if (!over) return router.navigate(options);
      return router.navigate({
        href: over.href,
        // The router builds a mask from an href too; its type spells only `to`.
        mask: over.mask as RouterNavigateOptions['mask'],
        replace: options.replace,
        resetScroll: false,
      });
    },
    [router],
  );
  return navigate as UseNavigateResult<string>;
}
