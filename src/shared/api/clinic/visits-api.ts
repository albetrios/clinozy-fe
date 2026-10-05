import { appointmentQueryKeys } from './appointments-api.ts';
import type { Prescription, Treatment } from './clinic-schema.ts';
import type { InvoiceRecord } from './invoices-contracts.ts';
import type {
  ApproveVisitRxInput,
  CompleteVisitInput,
  CreateVisitBillInput,
  ReceiveVisitPaymentInput,
  RecordVisitSessionInput,
  ReverseVisitSessionInput,
  SetVisitChecksInput,
  SetVisitStageInput,
  ShareVisitInput,
  StartVisitInput,
  VisitCatalog,
  VisitChange,
  VisitCompletion,
  VisitDetail,
  VisitReceipt,
  VisitRecord,
} from './visits-contracts.ts';

/*
 * The Visit API (D18; Appendix F `getVisit`, `setVisitStage`, `completeVisit`
 * and the tabs' writes — there is no Visit in the schema yet). REPLACE_WITH_API:
 * every call runs on the fixture server, loaded on demand; when clinozy-be
 * serves visits, these bodies become `apiClient` calls and nothing else moves.
 */

const server = () => import('./fixtures/visits-server.fixtures.ts');

/** TanStack Query keys for visits — all under `['clinic', 'visits']`. */
export const visitQueryKeys = {
  all: ['clinic', 'visits'] as const,
  /** One visit with what its tabs read. */
  detail: (id: string) => [...visitQueryKeys.all, 'detail', id] as const,
  /** A patient's open visit — the file's Start visit / Resume. */
  open: (patientId: string) => [...visitQueryKeys.all, 'open', patientId] as const,
  /** The diagnosis list and the Rx kits. */
  catalog: () => [...visitQueryKeys.all, 'catalog'] as const,
};

/**
 * What a visit write may have changed: the visits, and Today's floor (under the
 * appointments prefix) — the card moves lanes. A tab's record write refreshes
 * the money reads too (`useVisits`).
 */
export const VISIT_WRITE_KEYS = [visitQueryKeys.all, appointmentQueryKeys.all] as const;

/** Move a checked-in booking's visit to a stage — "Send in" moves it to the doctor. */
export async function setVisitStage(input: SetVisitStageInput): Promise<VisitChange> {
  return (await server()).setVisitStage(input);
}

/** Undo a stage write by the token it answered. */
export async function undoVisitChange(undoToken: string): Promise<void> {
  return (await server()).undoVisitChange(undoToken);
}

/** One visit with what its tabs read (`getVisit`) — a 404 when it is unknown or gone. */
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

/** Approve the Rx and keep the consult note — the visit moves on. */
export async function approveVisitRx(
  input: ApproveVisitRxInput,
): Promise<{ visit: VisitRecord; prescription: Prescription }> {
  return (await server()).approveVisitRx(input);
}

/** Record today's session — one package session; the visit moves to Checkout. */
export async function recordVisitSession(
  input: RecordVisitSessionInput,
): Promise<{ visit: VisitRecord; treatment: Treatment }> {
  return (await server()).recordVisitSession(input);
}

/** Reverse today's session with a reason (a soft delete). */
export async function reverseVisitSession(
  input: ReverseVisitSessionInput,
): Promise<Treatment> {
  return (await server()).reverseVisitSession(input);
}

/** The Undo of a Reverse: the session back on the visit. */
export async function restoreVisitSession(
  visitId: string,
  treatmentId: string,
): Promise<Treatment> {
  return (await server()).restoreVisitSession(visitId, treatmentId);
}

/** Create the visit's bill from its lines. */
export async function createVisitBill(
  input: CreateVisitBillInput,
): Promise<{ visit: VisitRecord; invoice: InvoiceRecord }> {
  return (await server()).createVisitBill(input);
}

/** Receive a payment at checkout — the visit goes to the pharmacy or completes. */
export async function receiveVisitPayment(
  input: ReceiveVisitPaymentInput,
): Promise<VisitReceipt> {
  return (await server()).receiveVisitPayment(input);
}

/** Complete the visit and its booking. */
export async function completeVisit(input: CompleteVisitInput): Promise<VisitCompletion> {
  return (await server()).completeVisit(input);
}

/** Send the Rx, invoice and photos on WhatsApp. */
export async function shareVisit(input: ShareVisitInput): Promise<VisitRecord> {
  return (await server()).shareVisit(input);
}
