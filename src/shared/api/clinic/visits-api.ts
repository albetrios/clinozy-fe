import { appointmentQueryKeys } from './appointments-api.ts';
import type { InvoiceRecord } from './invoices-contracts.ts';
import type {
  CompleteVisitInput,
  CreateVisitBillInput,
  SetVisitChecksInput,
  ShareVisitInput,
  StartVisitInput,
  VisitCatalog,
  VisitCompletion,
  VisitDetail,
  VisitRecord,
  VisitRecordKind,
} from './visits-contracts.ts';

/*
 * The Visit API (D18; Appendix F `getVisit`, `setVisitStage`, `completeVisit`
 * and the file flow's writes — there is no Visit in the schema yet).
 * REPLACE_WITH_API: every call runs on the fixture server, loaded on demand;
 * when clinozy-be serves visits, these bodies become `apiClient` calls and
 * nothing else moves.
 */

const server = () => import('./fixtures/visits-server.fixtures.ts');

/** TanStack Query keys for visits — all under `['clinic', 'visits']`. */
export const visitQueryKeys = {
  all: ['clinic', 'visits'] as const,
  /** One visit with the records written at it. */
  detail: (id: string) => [...visitQueryKeys.all, 'detail', id] as const,
  /** A patient's open visit — the file's Start visit / Resume. */
  open: (patientId: string) => [...visitQueryKeys.all, 'open', patientId] as const,
  /** The diagnosis list and the Rx kits. */
  catalog: () => [...visitQueryKeys.all, 'catalog'] as const,
};

/**
 * What a visit write may have changed: the visits, and Today's floor (under the
 * appointments prefix) — the card moves lanes. The record writes a visit
 * follows (an Rx, a session, a receipt) refresh them too.
 */
export const VISIT_WRITE_KEYS = [visitQueryKeys.all, appointmentQueryKeys.all] as const;

/** One visit with the records written at it (`getVisit`) — a 404 when it is unknown or gone. */
export async function fetchVisit(id: string): Promise<VisitDetail> {
  return (await server()).getVisit(id);
}

/** The patient's open visit today, or null — the file's Start visit / Resume. */
export async function fetchOpenVisit(patientId: string): Promise<VisitRecord | null> {
  return (await server()).getOpenVisit(patientId);
}

/** The clinic's diagnosis list and Rx kits (Appendix F). */
export async function fetchVisitCatalog(): Promise<VisitCatalog> {
  return (await server()).getVisitCatalog();
}

/** "Start visit": the patient's open visit, else one for today's booking, else one without. */
export async function startVisit(input: StartVisitInput): Promise<VisitRecord> {
  return (await server()).startVisit(input);
}

/** Tick or untick the file's safety checks. */
export async function setVisitChecks(input: SetVisitChecksInput): Promise<VisitRecord> {
  return (await server()).setVisitChecks(input);
}

/** Create the visit's bill from its lines. */
export async function createVisitBill(
  input: CreateVisitBillInput,
): Promise<{ visit: VisitRecord; invoice: InvoiceRecord }> {
  return (await server()).createVisitBill(input);
}

/**
 * The server's side of a record written at the patient's open visit (D18: the
 * stage follows the records, `S:352`) — the Rx, the session and the receipt
 * writes call it after their own write, so Today's card moves on. REPLACE_WITH_API:
 * clinozy-be derives the stage itself.
 */
export async function advanceVisitAfter(
  patientId: string,
  kind: VisitRecordKind,
): Promise<void> {
  await (await server()).advanceVisitAfter(patientId, kind);
}

/** Complete the visit and its booking. */
export async function completeVisit(input: CompleteVisitInput): Promise<VisitCompletion> {
  return (await server()).completeVisit(input);
}

/** Send the Rx, invoice and photos on WhatsApp. */
export async function shareVisit(input: ShareVisitInput): Promise<VisitRecord> {
  return (await server()).shareVisit(input);
}
