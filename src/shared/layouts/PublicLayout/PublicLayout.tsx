import { Outlet } from '@tanstack/react-router';

import { PublicFrame } from '@/shared/components/PublicFrame/index.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';
import { WorkspaceSwitchOverlay } from '@/shared/components/WorkspaceSwitchOverlay/index.ts';

/**
 * Chrome for public, non-app routes — `/callback`, `/unauthorized`,
 * `/onboarding` and `/accept-invite/$id` — the launch's signed-out canvas
 * (L-65): the same frame as sign-in — the logo where the clinic header draws
 * it, the theme toggle at the end — around the routed page, which brings its
 * own card or empty state.
 */
export function PublicLayout() {
  return (
    <>
      {/*
        The workspace-switch cover, mounted HERE as well as in `AppLayout`.
        Finishing onboarding activates a workspace and then hands the user over
        to it, and that whole hop happens on THIS layout — so a cover that only
        the app shell mounts could not appear until the destination had already
        arrived, which is the one moment it has nothing left to say.

        Mounted in the two layouts rather than once at the route root on
        purpose: the root component is entry-resident, and putting it there cost
        the initial JS bundle ~15 kB gzipped against a budget with under half a
        kilobyte of headroom. Both layouts are lazy route components, so here it
        costs nothing before it can possibly be needed. It renders `null` unless
        a switch is in flight, so the two mounts never collide.
      */}
      <WorkspaceSwitchOverlay />
      <PublicFrame
        testId="public-layout"
        mainId="public-main-content"
        controls={<ThemeModeToggle surface="frame" />}
      >
        <Outlet />
      </PublicFrame>
    </>
  );
}
