import { useEffect, useState } from 'react';

import { isAppSplashActive, onAppSplashDismissed } from '@/lib/app-splash.ts';

/**
 * True while the HTML boot splash (`#app-splash`) still covers the page, false
 * from its dismissal on — it never comes back within a page load.
 *
 * The app renders under the splash at opacity 0, so anything that must not be
 * seen or announced twice through it stays out until this turns false: the
 * full-page loader (the splash IS the loader then) and the offline pill (the
 * splash says the same line, with its own Retry).
 */
export function useAppSplashActive(): boolean {
  const [active, setActive] = useState(isAppSplashActive);

  useEffect(() => {
    if (!active) return;
    return onAppSplashDismissed(() => setActive(false));
  }, [active]);

  return active;
}
