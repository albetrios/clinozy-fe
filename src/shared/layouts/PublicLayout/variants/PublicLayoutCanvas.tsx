import { Outlet } from '@tanstack/react-router';

import { PublicFrame } from '@/shared/components/PublicFrame/index.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';

/**
 * Variant 0 — the launch's signed-out canvas (default; L-65): the same frame
 * as sign-in — the logo where the clinic header draws it, the theme toggle at
 * the end — around the routed page, which brings its own card or empty state.
 */
export function CanvasPublic() {
  return (
    <PublicFrame
      testId="public-layout"
      mainId="public-main-content"
      controls={<ThemeModeToggle surface="frame" />}
    >
      <Outlet />
    </PublicFrame>
  );
}
