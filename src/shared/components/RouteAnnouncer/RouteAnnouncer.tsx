import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * Announces SPA navigations to screen readers. Routed page changes swap
 * content in place, so without this an assistive-tech user hears silence on
 * every link click. After each resolved navigation that changed the path we
 * read the committed `document.title` (set per route from the island
 * manifest via `manifestHead`) and surface it in a polite live region.
 * Hash-only changes (the #settings modal) are skipped — the modal manages
 * its own focus. The initial page load is announced natively by the browser.
 */
export function RouteAnnouncer() {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let frame = 0;
    const unsubscribe = router.subscribe('onResolved', ({ pathChanged }) => {
      if (!pathChanged) return;
      // Read the title one frame later — <HeadContent /> commits the new
      // document.title in the same React pass that resolved the route.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setAnnouncement(document.title);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [router]);

  // <output> carries an implicit status role + polite live semantics
  // (kept explicit for assistive-tech engines that only honor the attribute).
  return (
    <output aria-live="polite" className="sr-only">
      {announcement}
    </output>
  );
}
