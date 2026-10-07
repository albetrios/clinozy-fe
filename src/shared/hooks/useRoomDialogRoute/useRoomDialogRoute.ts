import type { QueryKey } from '@tanstack/react-query';
import { useLocation, useParams } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import type { Section } from '@/shared/api/clinic/clinic-schema.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteLocation } from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

/**
 * The dialog a room tab's URL opens over its list (KICKOFF §4, D24):
 * `<tab>/create` with its prefill, a tab's own action (`items/check`), or a
 * record's route — `<tab>/<id>` (a view), `…/edit`, `…/receive`, `…/return`,
 * `…/visits/create` — with the record once loaded.
 */
export type RoomDialogRoute<T, TPrefill> =
  | { kind: 'none' }
  | { kind: 'create'; prefill: TPrefill }
  /** A tab's own action route — `items/check` opens Stock check. */
  | { kind: 'action'; action: string }
  | {
      kind: 'record';
      /** What follows the id in the URL: '' (the view), 'edit', 'receive', 'return', 'visits/create'. */
      action: string;
      id: string;
      record: T | undefined;
    };

/** The dialog, and how it closes: back to the tab with the list's own params. */
export interface RoomDialogRouteState<T, TPrefill> {
  dialog: RoomDialogRoute<T, TPrefill>;
  close: () => void;
}

/** Options of {@link useRoomDialogRoute}. */
export interface UseRoomDialogRouteOptions<T, TPrefill> {
  /** The clinic section whose access a create route needs. */
  section: Section;
  /** What a create — or a tab action — route needs in that section, all of them (Create by default). */
  createActions?: readonly ClinicAction[];
  /** The tab's own action routes, by their last segment (`check`), gated like a create. */
  tabActions?: readonly string[];
  /** Back to the tab's list, keeping its search, filters and sort. */
  close: () => void;
  /** The route param naming the record (`medicineId`, `itemId`). */
  param: string;
  queryKey: (id: string) => QueryKey;
  fetchRecord: (id: string) => Promise<T>;
  /** The record's name in "<Record> not found · it may have been deleted". */
  recordLabel: string;
  /** The create route's prefill, read from the URL's search. */
  readPrefill: (search: Record<string, unknown>) => TPrefill;
}

/** Create unless a room says otherwise. */
const CREATE: readonly ClinicAction[] = ['create'];

/** No tab action routes unless a room has some. */
const NO_ACTIONS: readonly string[] = [];

/** What a path without a record opens: a create, one of the tab's own actions, or nothing. */
function listRouteOf(pathname: string, tabActions: readonly string[]) {
  if (/\/create\/?$/.test(pathname)) return { kind: 'create' } as const;
  const lastSegment = pathname.replace(/\/$/, '').split('/').at(-1) ?? '';
  return tabActions.includes(lastSegment)
    ? ({ kind: 'action', action: lastSegment } as const)
    : null;
}

/** A record's route, once its record exists: what follows the id is the action. */
function recordRouteOf<T, TPrefill>(
  pathname: string,
  id: string,
  drawer: { isOpen: boolean; record: T | undefined },
): RoomDialogRoute<T, TPrefill> {
  if (!drawer.isOpen) return { kind: 'none' };
  const after = pathname.split(`/${id}`)[1] ?? '';
  return {
    kind: 'record',
    action: after.replace(/(?:^\/)|(?:\/$)/g, ''),
    id,
    record: drawer.record,
  };
}

/**
 * A create or tab action the member may not open: the permission toast, once
 * per link — a re-render with a new `close` never toasts again — and back to
 * the list.
 */
function useRefusal(refused: boolean, pathname: string, close: () => void) {
  const { t } = useTranslation(ERRORS_NS);
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, t]);
}

/**
 * Which drawer a room tab's URL opens — its dialog routes render nothing, so
 * the tab page reads them here (KICKOFF §6.7–§6.8 Routes). A member without
 * the create access who follows a create link lands back on the list with the
 * permission toast. An id that names no record (a stale link, a deleted
 * record) opens nothing: the URL goes back to the list in place, with
 * "<Record> not found · it may have been deleted" (`S:115`). Record routes
 * stay open to a viewer — the drawer is view only. `close` returns to the list
 * with its search, filters and sort, and drops the prefill. Over another
 * room's page (A-P1, `useCrossRoomDialog` — New sale from the patient file or
 * Today) it reads the drawer's own route, and every way out goes back to that
 * page.
 */
export function useRoomDialogRoute<T, TPrefill>({
  section,
  createActions = CREATE,
  tabActions = NO_ACTIONS,
  close: closeToList,
  param,
  queryKey,
  fetchRecord,
  recordLabel,
  readPrefill,
}: UseRoomDialogRouteOptions<T, TPrefill>): RoomDialogRouteState<T, TPrefill> {
  const routeParams: Record<string, string | undefined> = useParams({ strict: false });
  // The path and the prefill come from one location: while a dialog route is
  // still resolving, the list's own match holds the search it had before.
  const routePathname = useLocation({ select: (location) => location.pathname });
  const routeSearch: Record<string, unknown> = useLocation({
    select: (location) => location.search,
  });
  const { params, pathname, search, crossRoom } = useDialogRouteLocation({
    params: routeParams,
    pathname: routePathname,
    search: routeSearch,
  });
  const close = crossRoom ? crossRoom.close : closeToList;
  const access = useClinicAccess();

  const id = params[param];
  const drawer = useDialogRouteRecord({
    id,
    queryKey,
    fetchRecord,
    recordLabel,
    onMissing: close,
  });
  const listRoute = id === undefined ? listRouteOf(pathname, tabActions) : null;
  const refused =
    listRoute !== null &&
    access.isResolved &&
    !createActions.every((action) => access.can(section, action));
  useRefusal(refused, pathname, close);

  if (id !== undefined) {
    return { dialog: recordRouteOf<T, TPrefill>(pathname, id, drawer), close };
  }
  if (listRoute === null || refused) return { dialog: { kind: 'none' }, close };
  if (listRoute.kind === 'action') return { dialog: listRoute, close };
  // The create route's prefill, parsed from the URL's raw values.
  return { dialog: { kind: 'create', prefill: readPrefill(search) }, close };
}
