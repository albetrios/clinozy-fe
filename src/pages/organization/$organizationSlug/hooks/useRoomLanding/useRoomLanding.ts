import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';

import { APP_MODULES } from '@/core/config/app-modules.ts';
import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import { APP_SECTION_ROUTES } from '@/shared/app/app-home.ts';
import { appSectionForPath, appSectionLanding } from '@/shared/app/app-sections.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';

/**
 * Off a room the access in force can't view (KICKOFF §6.12 View-as; Q-U11):
 * the org layout takes the member to the first room they can view, in nav
 * order after Today — Users → Leads for a Doctor previewed from Roles &
 * access, and the same on "Exit preview" when their own access can't view
 * the room they are on. A viewable room, a path outside the rooms and an
 * unresolved access stay put; a room whose module the deployment turns off is
 * never a destination. The URL is replaced, so Back doesn't return to it,
 * and the hash (an open Settings modal) rides along.
 */
export function useRoomLanding(): void {
  const { isResolved, viewableSections } = useAppAccess();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { organizationSlug = '' } = useParams({ strict: false });
  const navigate = useNavigate();
  const section = appSectionForPath(pathname);
  const landing =
    isResolved && section !== null && !viewableSections.includes(section)
      ? appSectionLanding(
          section,
          viewableSections.filter((open) => isModuleEnabled(APP_MODULES[open])),
        )
      : null;

  useEffect(() => {
    if (!(landing && organizationSlug)) return;
    void navigate({
      to: APP_SECTION_ROUTES[landing],
      params: { organizationSlug },
      // The Settings modal is the hash's: it stays open over the new room.
      hash: true,
      replace: true,
    });
  }, [landing, navigate, organizationSlug]);
}
