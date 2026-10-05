import type { AnyRouter, ParsedLocation } from '@tanstack/react-router';

/**
 * Where a navigation went, as the URL bar shows it: the router's location —
 * or, when another room's drawer opened over the page it came from (A-P1,
 * `useClinicNavigate`), the drawer's own route that the page is masked as.
 * The page itself stays `router.state.location`.
 */
export function shownLocation(router: AnyRouter): ParsedLocation {
  const { location } = router.state;
  return location.maskedLocation ?? location;
}
