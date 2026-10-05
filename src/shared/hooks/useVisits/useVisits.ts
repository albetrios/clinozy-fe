import { todayQueryKeys } from '@/shared/api/clinic/today-api.ts';
import type { TodayFloorRow } from '@/shared/api/clinic/today-contracts.ts';
import {
  approveVisitRx,
  completeVisit,
  createVisitBill,
  fetchOpenVisit,
  fetchVisit,
  fetchVisitCatalog,
  receiveVisitPayment,
  recordVisitSession,
  restoreVisitSession,
  reverseVisitSession,
  setVisitChecks,
  setVisitStage,
  shareVisit,
  startVisit,
  undoVisitChange,
  VISIT_WRITE_KEYS,
  visitQueryKeys,
} from '@/shared/api/clinic/visits-api.ts';
import type {
  SetVisitChecksInput,
  SetVisitStageInput,
  VisitChange,
  VisitDetail,
  VisitRecord,
  VisitStage,
} from '@/shared/api/clinic/visits-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { INVOICE_WRITE_KEYS } from '@/shared/hooks/useInvoices/index.ts';

/**
 * The Visit's reads and writes (D18): Today's stage moves and their Undo, and
 * what the Visit sheet and the patient file's flow write — the safety checks,
 * the Rx, the session, the bill, the payment, the share and the end of the
 * visit. Writes toast only their errors; the screens toast success themselves
 * with their own words.
 */

const isFloorRow = (value: unknown): value is TodayFloorRow =>
  typeof value === 'object' && value !== null && 'id' in value && 'visit' in value;

/**
 * A cached floor with one booking's visit moved to `stage` as of `at` — the
 * optimistic side of a stage write. A visit not yet on record carries no id
 * until the refetch brings the server's.
 */
export function withVisitStage(
  data: unknown,
  appointmentId: string,
  stage: VisitStage,
  at: string,
): unknown {
  if (!Array.isArray(data)) return data;
  let changed = false;
  const next = data.map((row: unknown) => {
    if (!(isFloorRow(row) && row.id === appointmentId)) return row;
    changed = true;
    return { ...row, visit: { id: row.visit?.id ?? '', stage, stageAt: at } };
  });
  return changed ? next : data;
}

/**
 * Move a checked-in booking's visit to a stage — optimistic: the floor shows
 * the card in its new lane at once and puts it back if the server refuses
 * (409 with its words). Answers the visit and its Undo token.
 */
export function useSetVisitStage() {
  return useAppMutation<VisitChange, SetVisitStageInput>({
    mutationFn: setVisitStage,
    invalidateKeys: [...VISIT_WRITE_KEYS],
    optimisticQueries: {
      queryKey: todayQueryKeys.floors(),
      update: (data, { appointmentId, stage }) =>
        withVisitStage(data, appointmentId, stage, new Date().toISOString()),
    },
  });
}

/** Undo a stage write by its token — the toast's "Undo"; silent unless it fails. */
export function useUndoVisitChange() {
  return useAppMutation<void, string>({
    mutationFn: undoVisitChange,
    invalidateKeys: [...VISIT_WRITE_KEYS],
  });
}

// ── The Visit sheet and the file's flow ──

/**
 * What a tab's record write may have changed beyond the visit: the money reads,
 * the patient's records and dues, the invoices, the plan, the floor, the tasks
 * (an aftercare call, a payment due) and Medical's "Prescriptions to fill".
 */
const RECORD_WRITE_KEYS = [visitQueryKeys.all, ...INVOICE_WRITE_KEYS];

/**
 * One visit with what its tabs read (`getVisit`); idle without an id. A 404
 * raises no toast here — the sheet's route reports "Visit not found".
 */
export function useVisitDetail(visitId: string | null) {
  return useAppQuery({
    queryKey: visitQueryKeys.detail(visitId ?? ''),
    queryFn: () => fetchVisit(visitId ?? ''),
    enabled: Boolean(visitId),
    notifyOnError: false,
  });
}

/** The patient's open visit today — the file's Start visit / Resume; idle without a patient. */
export function useOpenVisit(patientId: string) {
  return useAppQuery({
    queryKey: visitQueryKeys.open(patientId),
    queryFn: () => fetchOpenVisit(patientId),
    enabled: patientId !== '',
    notifyOnError: false,
  });
}

/** The clinic's diagnosis list and Rx kits — they change rarely, so they stay fresh. */
export function useVisitCatalog() {
  return useAppQuery({
    queryKey: visitQueryKeys.catalog(),
    queryFn: fetchVisitCatalog,
    staleTime: Infinity,
  });
}

/** "Start visit" — the open visit, or a new one (its booking checked in when it is today's). */
export function useStartVisit() {
  return useAppMutation({
    mutationFn: startVisit,
    invalidateKeys: [...VISIT_WRITE_KEYS],
  });
}

const isVisitRecord = (value: unknown): value is VisitRecord =>
  typeof value === 'object' && value !== null && 'id' in value && 'checks' in value;

const isVisitDetail = (value: unknown): value is VisitDetail =>
  typeof value === 'object' &&
  value !== null &&
  'visit' in value &&
  isVisitRecord(value.visit);

/**
 * A cached visit with its checks patched — the tiles tick at once. Patches the
 * two shapes that carry the visit (a detail, the file's open visit) and leaves
 * every other cached read under the visits key (the catalogue, none) as it is.
 */
export function withVisitChecks(data: unknown, input: SetVisitChecksInput): unknown {
  const patch = (visit: VisitRecord): VisitRecord =>
    visit.id === input.visitId
      ? { ...visit, checks: { ...visit.checks, ...input.checks } }
      : visit;
  if (isVisitDetail(data)) {
    const visit = patch(data.visit);
    return visit === data.visit ? data : { ...data, visit };
  }
  return isVisitRecord(data) ? patch(data) : data;
}

/** Tick or untick the file's safety checks — optimistic, put back if the server refuses. */
export function useSetVisitChecks() {
  return useAppMutation({
    mutationFn: setVisitChecks,
    invalidateKeys: [visitQueryKeys.all],
    optimisticQueries: { queryKey: visitQueryKeys.all, update: withVisitChecks },
  });
}

/** How a record write reports a failure. */
export interface VisitWriteOptions {
  /**
   * Toast the mapped error (default false: the Visit sheet shows a failure in
   * place — "Not saved · your changes are kept" — and toasts it with Retry
   * itself; the file's flow, which has no such row, passes true).
   */
  notifyOnError?: boolean;
}

/**
 * The tabs' record writes. Not optimistic — each shows as done only once the
 * server confirms (`today.md:121`), and each is single-flight (a second press
 * joins the first; the fetch client's idempotency key covers a retry).
 */
const recordWrite = ({ notifyOnError = false }: VisitWriteOptions) =>
  ({ invalidateKeys: RECORD_WRITE_KEYS, notifyOnError }) as const;

/** Approve the Rx and keep the consult note. */
export function useApproveVisitRx(options: VisitWriteOptions = {}) {
  return useAppMutation({ mutationFn: approveVisitRx, ...recordWrite(options) });
}

/** Record today's session. */
export function useRecordVisitSession(options: VisitWriteOptions = {}) {
  return useAppMutation({ mutationFn: recordVisitSession, ...recordWrite(options) });
}

/**
 * Reverse today's session with a reason — its failure toasts (the reason
 * confirm shows only a 422 on the reason or the note in place).
 */
export function useReverseVisitSession() {
  return useAppMutation({
    mutationFn: reverseVisitSession,
    ...recordWrite({ notifyOnError: true }),
  });
}

/** The Undo of a Reverse — silent unless it fails. */
export function useRestoreVisitSession() {
  return useAppMutation({
    mutationFn: ({ visitId, treatmentId }: { visitId: string; treatmentId: string }) =>
      restoreVisitSession(visitId, treatmentId),
    invalidateKeys: RECORD_WRITE_KEYS,
  });
}

/** Create the visit's bill. */
export function useCreateVisitBill(options: VisitWriteOptions = {}) {
  return useAppMutation({ mutationFn: createVisitBill, ...recordWrite(options) });
}

/** Receive a payment at checkout. */
export function useReceiveVisitPayment(options: VisitWriteOptions = {}) {
  return useAppMutation({ mutationFn: receiveVisitPayment, ...recordWrite(options) });
}

/** Complete the visit and its booking. */
export function useCompleteVisit(options: VisitWriteOptions = {}) {
  return useAppMutation({ mutationFn: completeVisit, ...recordWrite(options) });
}

/** Send the Rx, invoice and photos on WhatsApp — its failure toasts (no tab row shows it). */
export function useShareVisit() {
  return useAppMutation({
    mutationFn: shareVisit,
    ...recordWrite({ notifyOnError: true }),
  });
}
