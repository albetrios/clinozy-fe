/**
 * The rooms a shared drawer route can keep behind it (KICKOFF §4): a drawer
 * opened from another room — the Invoice drawer from the patient file, Receive
 * from Today, a booking from a lead — carries `from=<room path>` so a deep link
 * still has a page behind it. Paths are relative to the organization and must
 * match one of these exactly; anything else falls back to the route's own
 * default, so `from` can never point outside the app.
 */
/** The patient-file sections (D26), in the file's order. */
export const PATIENT_FILE_SECTIONS = [
  'timeline',
  'overview',
  'visits',
  'prescriptions',
  'treatments',
  'images',
  'reports',
  'invoices',
  'payments',
  'packages',
  'notes',
] as const;

/**
 * A patient-file section: `patients/<uuid>/<section>`. A literal on purpose (the
 * security lint forbids built RegExps); a test pins its sections to
 * {@link PATIENT_FILE_SECTIONS}.
 */
export const PATIENT_FILE_REFERRER =
  /^patients\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:timeline|overview|visits|prescriptions|treatments|images|reports|invoices|payments|packages|notes)$/;

const REFERRER_PATTERNS: readonly RegExp[] = [
  /^today$/,
  /^leads$/,
  /^appointments$/,
  /^patients$/,
  PATIENT_FILE_REFERRER,
  /^medical\/sales$/,
  /^payments$/,
  /^payments\/pending$/,
  /^tasks$/,
];

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
