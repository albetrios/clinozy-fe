/**
 * The rooms a shared drawer route can keep behind it (KICKOFF §4): a drawer
 * opened from another room — the Invoice drawer from the patient file, Receive
 * from Today, a booking from a lead — carries `from=<room path>` so a deep link
 * still has a page behind it. Paths are relative to the organization and must
 * match one of these exactly; anything else falls back to the route's own
 * default, so `from` can never point outside the app.
 */

/**
 * A patient-file section: `patients/<uuid>/<section>`. A literal on purpose (the
 * security lint forbids built RegExps); a test pins its sections to the file's
 * (`PATIENT_FILE_SECTIONS`, `patient-file-sections.ts`).
 */
export const PATIENT_FILE_REFERRER =
  /^patients\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:timeline|overview|visits|prescriptions|treatments|images|reports|invoices|payments|packages|notes)$/;

/**
 * The patient's visit flow — `patients/<uuid>/timeline?visit=open`, with
 * `&from=today` when Today's card opened it (KICKOFF §6.6, L-64): the one
 * referrer that carries a query, so a drawer the flow opens in another room
 * (the Rx drawer's "Save & sell") closes back into the flow. Built by
 * {@link visitFlowReferrer}.
 */
const VISIT_FLOW_REFERRER =
  /^patients\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/timeline\?visit=open(?:&from=today)?$/;

const REFERRER_PATTERNS: readonly RegExp[] = [
  /^today$/,
  /^leads$/,
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

/** An org page's path relative to the organization: `/organization/acme/patients` → `patients`. */
const ORGANIZATION_PAGE = /^\/organization\/[^/]+\/(.+?)\/?$/;

/**
 * The `from` a drawer opened from the page at `pathname` carries — the
 * sender's side of {@link safeReferrer}: the page's org-relative path when a
 * drawer may keep it behind, else null (the drawer opens over its own room).
 */
export function referrerFromPath(pathname: string): string | null {
  const page = ORGANIZATION_PAGE.exec(pathname)?.[1];
  return page && isAllowedReferrer(page) ? page : null;
}
