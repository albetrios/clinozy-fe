import { createContext, useContext } from 'react';

/**
 * A drawer another room owns, open over the room that opened it (KICKOFF §4,
 * A-P1) — the Invoice drawer over the patient file, Receive over Today, a
 * booking over the Leads list. The referring page stays the router's route;
 * the drawer's dialog-route hook reads its dialog from the drawer's own route
 * here instead, and every way out — close, a refused create, a dead record
 * link — goes back to that page as it was.
 */
export interface CrossRoomDialog {
  /** The drawer route's path, `/organization/acme/invoices/create`. */
  pathname: string;
  /** The drawer route's search — its prefill and its `from`. */
  search: Record<string, unknown>;
  /** The drawer route's params: the org slug and, on a record route, its id. */
  params: Record<string, string | undefined>;
  /** Back to the page behind, its search and state as they were. */
  close: () => void;
}

/**
 * The cross-room drawer a subtree renders — provided by the app's host over
 * the referring page (`src/app/routes/CrossRoomDialogs.tsx`).
 */
export const CrossRoomDialogContext = createContext<CrossRoomDialog | null>(null);

/**
 * The cross-room drawer this drawer host renders, or null when the drawer is
 * on its own route — the router's location is the dialog's then.
 */
export function useCrossRoomDialog(): CrossRoomDialog | null {
  return useContext(CrossRoomDialogContext);
}

/** Where a dialog-route hook reads its dialog from. */
export interface DialogRouteLocation {
  params: Record<string, string | undefined>;
  pathname: string;
  search: Record<string, unknown>;
  /** The cross-room drawer when this one opens over another room's page — its `close` is every way out. */
  crossRoom: CrossRoomDialog | null;
}

/**
 * The location a room's dialog-route hook reads its dialog from: the drawer's
 * own route — the cross-room drawer's when it opens over another room's page
 * (A-P1), else `route`, the router's as the hook reads it.
 */
export function useDialogRouteLocation(
  route: Omit<DialogRouteLocation, 'crossRoom'>,
): DialogRouteLocation {
  const crossRoom = useCrossRoomDialog();
  if (!crossRoom) return { ...route, crossRoom: null };
  const { params, pathname, search } = crossRoom;
  return { params, pathname, search, crossRoom };
}
