import { defaultParseSearch, defaultStringifySearch } from '@tanstack/react-router';

/**
 * The rooms a shared drawer route can keep behind it (KICKOFF §4): a drawer
 * opened from another room — the Invoice drawer from the patient file, Receive
 * from Today, a booking from a lead — carries `from=<room path>` so a deep link
 * still has a page behind it. Paths are relative to the organization and must
 * match one of these exactly; anything else falls back to the route's own
 * default, so `from` can never point outside the app.
 *
 * The room is kept behind for real (A-P1): {@link crossRoomNavigation} opens
 * such a drawer over the referring page — still mounted, its search kept —
 * while the URL bar shows the drawer's own route; {@link crossRoomDialogOf}
 * reads it back for the host that renders the drawer there.
 */

/**
 * A patient-file section: `patients/<patient id>/<section>` — a clinozy-be patient (`pat_…`),
 * or a fixture patient (a UUID) that a room still on fixtures (the parked Medical room) names.
 * A literal on purpose (the security lint forbids built RegExps); a test pins its sections to
 * the file's (`PATIENT_FILE_SECTIONS`, `patient-file-sections.ts`).
 */
export const PATIENT_FILE_REFERRER =
  /^patients\/(?:pat_[a-z0-9]{21}|[0-9a-f-]{36})\/(?:timeline|overview|visits|prescriptions|treatments|images|reports|invoices|payments|packages|notes)$/;

/**
 * The patient's visit flow — `patients/<patient id>/timeline?visit=open`, with
 * `&from=today` when Today's card opened it (KICKOFF §6.6, L-64): the one
 * referrer that carries a query, so a drawer the flow opens in another room
 * (the Rx drawer's "Save & sell") closes back into the flow. Built by
 * {@link visitFlowReferrer}.
 */
const VISIT_FLOW_REFERRER =
  /^patients\/pat_[a-z0-9]{21}\/timeline\?visit=open(?:&from=today)?$/;

const REFERRER_PATTERNS: readonly RegExp[] = [
  /^today$/,
  /^leads$/,
  // The lead drawer: a booking from its contact card opens over it (A-P1). A lead is a
  // clinozy-be public id (`lead_<21 [a-z0-9]>`).
  /^leads\/lead_[a-z0-9]{21}$/,
  /^appointments$/,
  /^patients$/,
  PATIENT_FILE_REFERRER,
  VISIT_FLOW_REFERRER,
  /^medical\/sales$/,
  /^payments$/,
  /^payments\/pending$/,
  /^tasks$/,
];

/** The room a visit link goes back to — and the patient page's way back (`from`). */
export const VISIT_REFERRER = 'today';

/**
 * The visit flow as a drawer's `from`: closing the drawer lands back in the
 * patient's flow — Today still its way back when Today opened it.
 */
export function visitFlowReferrer(patientId: string, fromToday: boolean): string {
  const search = fromToday ? `visit=open&from=${VISIT_REFERRER}` : 'visit=open';
  return `patients/${patientId}/timeline?${search}`;
}

/** Whether `from` names a room a drawer may keep behind it. */
export function isAllowedReferrer(from: string): boolean {
  return REFERRER_PATTERNS.some((pattern) => pattern.test(from));
}

/**
 * The room to render behind a drawer: `from` when it is on the allow-list,
 * else `fallback` (the drawer route's own parent, e.g. the Payments ledger).
 */
export function safeReferrer(from: unknown, fallback: string): string {
  return typeof from === 'string' && isAllowedReferrer(from) ? from : fallback;
}

/**
 * An org page: the organization's prefix and the path relative to it —
 * `/organization/acme/patients` → `/organization/acme/` and `patients`.
 */
const ORGANIZATION_PAGE = /^(\/organization\/[^/]+\/)(.+?)\/?$/;

/** The org-relative path of `pathname`, or null outside an organization's pages. */
function organizationPathOf(pathname: string): string | null {
  return ORGANIZATION_PAGE.exec(pathname)?.[2] ?? null;
}

/**
 * The `from` a drawer opened from the page at `pathname` carries — the
 * sender's side of {@link safeReferrer}: the page's org-relative path when a
 * drawer may keep it behind, else null (the drawer opens over its own room).
 */
export function referrerFromPath(pathname: string): string | null {
  const page = organizationPathOf(pathname);
  return page && isAllowedReferrer(page) ? page : null;
}

/**
 * The href of an organization's page from its org-relative path — a `from` that
 * {@link safeReferrer} let through, or a page path a drawer leaves to
 * (`patients/pat_…/timeline`): the receiver's side of {@link referrerFromPath}.
 */
export function referrerHref(organizationSlug: string, from: string): string {
  return `/organization/${organizationSlug}/${from}`;
}

/** The search key a referring page's URL names the drawer open over it under (A-P1). */
export const CROSS_ROOM_PARAM = 'dialog';

/**
 * A drawer another room's page may open over itself (KICKOFF §4, A-P1): the
 * Invoice drawer (new, preview, edit), Receive payment, a ledger entry's drawer
 * (the patient file's Payments), the appointment drawers and New sale. Its dialog route keeps its own URL and gate; opened with a
 * `from` naming another room, it renders over that room instead of its own.
 */
export interface CrossRoomRoute {
  /** Its dialog route's name in `src/app/routes/dialog-routes.ts` — the manifest its gate reads. */
  name:
    | 'invoiceCreate'
    | 'invoice'
    | 'invoiceEdit'
    | 'paymentReceive'
    | 'paymentEdit'
    | 'appointmentCreate'
    | 'appointment'
    | 'saleCreate';
  /** Its path under the organization; a record route's id is the first group. */
  path: RegExp;
  /** The route param that id fills. */
  param?: 'invoiceId' | 'appointmentId' | 'paymentId';
  /** The room it opens over when no other room opened it: its route's own parent. */
  room: string;
}

/** Every drawer route another room may open over itself, in `dialog-routes.ts` order. */
export const CROSS_ROOM_ROUTES: readonly CrossRoomRoute[] = [
  {
    name: 'appointmentCreate',
    path: /^appointments\/create$/,
    room: 'appointments',
  },
  {
    name: 'appointment',
    // A booking is a clinozy-be public id (`appt_<21 [a-z0-9]>`).
    path: /^appointments\/(appt_[a-z0-9]{21})$/,
    param: 'appointmentId',
    room: 'appointments',
  },
  { name: 'paymentReceive', path: /^payments\/receive$/, room: 'payments' },
  {
    name: 'paymentEdit',
    // A ledger entry is a clinozy-be public id (`pay_<21 [a-z0-9]>`).
    path: /^payments\/(pay_[a-z0-9]{21})\/edit$/,
    param: 'paymentId',
    room: 'payments',
  },
  // The Invoice drawer's own default referrer is the Payments ledger (§4).
  { name: 'invoiceCreate', path: /^invoices\/create$/, room: 'payments' },
  {
    name: 'invoice',
    // An invoice is a clinozy-be public id (`invc_<21 [a-z0-9]>`).
    path: /^invoices\/(invc_[a-z0-9]{21})$/,
    param: 'invoiceId',
    room: 'payments',
  },
  {
    name: 'invoiceEdit',
    path: /^invoices\/(invc_[a-z0-9]{21})\/edit$/,
    param: 'invoiceId',
    room: 'payments',
  },
  { name: 'saleCreate', path: /^medical\/sales\/create$/, room: 'medical/sales' },
];

/** The cross-room drawer route at an org-relative path, with its record param — or null. */
function crossRoomRouteOf(
  path: string,
): { route: CrossRoomRoute; params: Record<string, string> } | null {
  for (const route of CROSS_ROOM_ROUTES) {
    const match = route.path.exec(path);
    if (!match) continue;
    const id = match[1];
    return { route, params: route.param && id ? { [route.param]: id } : {} };
  }
  return null;
}

/** A location as the router parses it — what the cross-room helpers read of it. */
export interface CrossRoomLocationInput {
  pathname: string;
  search: Record<string, unknown>;
  /** The search as the URL spells it, `?…` (the router's `searchStr`). */
  searchStr?: string;
  hash?: string;
  /** Path, search and hash, the way the URL bar shows them. */
  href: string;
}

/** The navigation that opens a drawer over the room it came from: where it goes, what the URL bar shows. */
export interface CrossRoomNavigation {
  /** The referring page, as it stands, with the drawer named in its search. */
  href: string;
  /** The drawer's own route — the masked URL: shareable, and what a refresh keeps. */
  mask: { href: string };
}

/**
 * How a navigation to a cross-room drawer `target` keeps the room it came
 * from behind it (A-P1): the referring page's URL — `current`, search and
 * hash as they stand, when the member is on the page `from` names; else that
 * page fresh (a deep link, a stale tab) — with the drawer's route in its
 * search, masked as the drawer's own route. The referring page's route stays
 * matched (its guards run, its page stays mounted) and the drawer's host
 * renders over it. Null when `target` is no cross-room drawer, or its `from`
 * names no allowed room other than the drawer's own — the drawer opens over
 * its own room, as it always has.
 */
export function crossRoomNavigation(
  target: CrossRoomLocationInput,
  current?: Pick<CrossRoomLocationInput, 'pathname' | 'search' | 'hash'>,
): CrossRoomNavigation | null {
  const page = ORGANIZATION_PAGE.exec(target.pathname);
  const [, organization = '', path = ''] = page ?? [];
  const drawer = crossRoomRouteOf(path);
  if (!page || drawer === null) return null;
  const from = safeReferrer(target.search.from, '');
  if (!from || from === drawer.route.room) return null;
  const referrer = referringPage(current, organization, from);
  const searchStr = target.searchStr ?? defaultStringifySearch(target.search);
  const search = defaultStringifySearch({
    ...referrer.search,
    [CROSS_ROOM_PARAM]: `${path}${searchStr}`,
  });
  return {
    href: `${referrer.pathname}${search}${referrer.fragment}`,
    mask: { href: target.href },
  };
}

/**
 * The page a cross-room drawer opens over: the member's, search and hash as
 * they stand, when it is the page `from` names in the same organization —
 * else that page fresh. The visit flow's `from` carries its query
 * (`timeline?visit=open`, {@link visitFlowReferrer}): it is the page's search,
 * so a drawer the flow opens returns into the flow.
 */
function referringPage(
  current: Pick<CrossRoomLocationInput, 'pathname' | 'search' | 'hash'> | undefined,
  organization: string,
  from: string,
): { pathname: string; search: Record<string, unknown>; fragment: string } {
  const at = from.indexOf('?');
  const path = at < 0 ? from : from.slice(0, at);
  const query = defaultParseSearch(at < 0 ? '' : from.slice(at));
  const fresh = { pathname: `${organization}${path}`, search: query, fragment: '' };
  if (!current?.pathname.startsWith(organization)) return fresh;
  if (organizationPathOf(current.pathname) !== path) return fresh;
  const fragment = current.hash ? `#${current.hash}` : '';
  return {
    pathname: current.pathname,
    search: { ...query, ...current.search },
    fragment,
  };
}

/** A cross-room drawer as the referring page's URL names it: the drawer route's own location. */
export interface CrossRoomDialogLocation {
  route: CrossRoomRoute;
  /** The drawer route's path, `/organization/acme/invoices/create`. */
  pathname: string;
  /** The drawer route's search — its prefill and its `from`. */
  search: Record<string, unknown>;
  /** The drawer route's params: the org slug and, on a record route, its id. */
  params: Record<string, string>;
  /** The drawer route's href. */
  href: string;
}

/**
 * The cross-room drawer `search` names over the page (the reader's side of
 * {@link crossRoomNavigation}) — or null when it names none, or names
 * anything but a cross-room drawer route: the value is checked against the
 * same table, so a hand-edited URL opens nothing else.
 */
export function crossRoomDialogOf(
  search: Record<string, unknown>,
  organizationSlug: string,
): CrossRoomDialogLocation | null {
  const value = search[CROSS_ROOM_PARAM];
  if (typeof value !== 'string' || !organizationSlug) return null;
  const at = value.indexOf('?');
  const path = at < 0 ? value : value.slice(0, at);
  const query = at < 0 ? '' : value.slice(at);
  const drawer = crossRoomRouteOf(path);
  if (!drawer) return null;
  const pathname = referrerHref(organizationSlug, path);
  return {
    route: drawer.route,
    pathname,
    search: defaultParseSearch(query),
    params: { organizationSlug, ...drawer.params },
    href: `${pathname}${query}`,
  };
}

/** `search` without the drawer it names — the referring page alone, as the drawer found it. */
export function withoutCrossRoomDialog(
  search: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(search).filter(([key]) => key !== CROSS_ROOM_PARAM),
  );
}
