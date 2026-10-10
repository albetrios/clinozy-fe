import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationPrescriptionCreate,
  organizationTreatmentCreate,
} from '@/lib/routes/patient-file-builders.ts';
import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { InvoiceRecord } from '@/shared/api/clinic/invoices-contracts.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import type {
  PrescriptionKit,
  PrescriptionRecord,
} from '@/shared/api/clinic/prescriptions-contracts.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import {
  type VisitCheck,
  type VisitChecks,
  visitChecksOf,
  type VisitRecord,
} from '@/shared/api/clinic/visits-contracts.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { visitFlowReferrer } from '@/shared/clinic/clinic-referrer.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { useMoveAppointment } from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useInvoiceList } from '@/shared/hooks/useInvoices/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import {
  useCreatePrescription,
  usePatientPrescriptions,
  usePrescriptionAccess,
  usePrescriptionKits,
} from '@/shared/hooks/usePrescriptions/index.ts';
import {
  useCreateTreatment,
  usePatientTreatments,
} from '@/shared/hooks/useTreatments/index.ts';
import {
  useSetVisitCheck,
  useSetVisitPaused,
  useVisitChecks,
} from '@/shared/hooks/useVisits/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useDefaultStaff } from '../../../shared/components/PatientStaffPicker/index.ts';
import {
  useVisitFlowReturn,
  type VisitFlowReturn,
  visitFlowSearch,
} from '../../../shared/hooks/useVisitFlowReturn/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { VISIT_FLOW_KEYS, VISIT_FLOW_NS } from './visit-flow.constants.ts';
import {
  repeatedSession,
  spendablePackage,
  type VisitBill,
  visitBill,
} from './visit-flow.ts';

const K = VISIT_FLOW_KEYS;

/** One step's read: its state once read, whether it is loading or failed, and its Retry. */
export interface VisitFlowRead<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

/** What the flow reads of the visit: the checks, the records written at it, the last session. */
export interface VisitFlowRecords {
  /** The safety checks — undefined for a member who can't read the clinical record. */
  checks?: VisitFlowRead<VisitChecks>;
  /** The Rx written at the visit (the latest) — undefined without Prescriptions read. */
  prescription?: VisitFlowRead<PrescriptionRecord | null>;
  /** The session recorded at the visit — undefined without Treatments read. */
  treatment?: VisitFlowRead<TreatmentRecord | null>;
  /** The patient's last session before this visit — the "⚡ Repeat" and its settings. */
  lastTreatment: TreatmentRecord | null;
  /**
   * The package the visit's session spent a session of — or, before it, the one a repeat would
   * spend (the last session's, while it can still spend one).
   */
  pack: PatientPackageRow | null;
  /** The member's Rx kits (`GET /app/prescription-kits`). */
  kits: readonly PrescriptionKit[];
  /**
   * What the visit has to bill and its invoice (D156) — undefined without `payment:read` or the
   * treatments' read (the visit's invoice is the one billing its sessions).
   */
  bill?: VisitFlowRead<VisitBill>;
}

/** What the flow may do — each action left out when the member can't. */
export interface VisitFlowActions {
  /** Tick or untick a check (`patient:update` with the clinical record). */
  toggleCheck?: (check: VisitCheck) => void;
  /** A check whose write is in flight — its tile waits. */
  checkSaving: (check: VisitCheck) => boolean;
  /** One tap from a kit saves an Rx at the visit (the Rx gate; approved for an approver, Q19). */
  prescribeKit?: (kit: PrescriptionKit) => void;
  writeRx?: () => void;
  /** "⚡ Repeat" — the last session again (the treatments gate). */
  repeatTreatment?: () => void;
  newTreatment?: () => void;
  /** Pause leaves the flow, the visit open; Resume runs it again (`appointment:update`). */
  pause?: () => void;
  resume?: () => void;
  complete?: () => void;
  /** "Create invoice from visit" — the Invoice drawer on its sessions (`payment:create`). */
  createInvoice?: () => void;
  /** "Custom invoice" — the Invoice drawer for this patient (`payment:create`). */
  customInvoice?: () => void;
  /** "Collect ₹X" — Receive payment against the visit's invoice while it owes (`payment:create`). */
  collect?: () => void;
}

/** A list read narrowed to one of its rows. */
function readOf<Row, T>(
  query: {
    data: Row[] | undefined;
    isPending: boolean;
    isError: boolean;
    refetch: () => Promise<unknown>;
  },
  pick: (rows: readonly Row[]) => T,
): VisitFlowRead<T> {
  return {
    data: query.data ? pick(query.data) : undefined,
    isLoading: query.isPending && !query.isError,
    isError: query.isError && query.data === undefined,
    retry: () => void query.refetch(),
  };
}

/** What the member may read and write of the visit's records. */
function useFlowAccess() {
  const { viewable } = usePatientFileContext();
  const access = useClinicAccess();
  const rx = usePrescriptionAccess();
  const money = usePaymentAccess();
  const resolved = access.isResolved;
  // The clinical record's code opens the Clinical notes section (its read).
  const readsClinical = viewable.includes('overview');
  const readsTreatments = viewable.includes('treatments');
  return {
    readsClinical,
    writesChecks: readsClinical && resolved && access.can('patients', 'edit'),
    readsRx: viewable.includes('prescriptions'),
    rx,
    readsTreatments,
    treats: resolved && passesPatientFileGate(access, 'treatments'),
    movesVisit: resolved && access.can('appointments', 'edit'),
    // The visit's invoice is found by the sessions it bills: both reads are needed.
    readsBill: readsTreatments && money.canRead,
    bills: money.canCreate,
  };
}

/** The flow's access to the visit's records. */
type FlowAccess = ReturnType<typeof useFlowAccess>;

/** The visit's bill as one read: the sessions and the day's invoices, loading, failed and Retry together. */
function billRead(
  treatments: {
    data: unknown;
    isPending: boolean;
    isError: boolean;
    refetch: () => Promise<unknown>;
  },
  invoices: {
    rows: InvoiceRecord[];
    isPending: boolean;
    isError: boolean;
    refetch: () => void;
  },
  sessions: readonly TreatmentRecord[],
): VisitFlowRead<VisitBill> {
  const failed =
    (treatments.isError && treatments.data === undefined) ||
    (invoices.isError && invoices.rows.length === 0);
  const ready = treatments.data !== undefined && !invoices.isPending;
  return {
    data: ready ? visitBill({ sessions, invoices: invoices.rows }) : undefined,
    isLoading: !(failed || ready),
    isError: failed,
    retry: () => {
      treatments.refetch().catch(() => undefined);
      invoices.refetch();
    },
  };
}

/** What every part of the flow's actions starts from: the visit, its records, the access, the URL. */
interface FlowBase {
  visit: VisitRecord;
  records: VisitFlowRecords;
  can: FlowAccess;
  flow: VisitFlowReturn;
}

/**
 * The visit's records the flow reads (KICKOFF §6.6; api-integration §5.4): its safety-check
 * notes, the patient's prescriptions and sessions — the visit's own are the ones carrying its
 * booking — their packages and the member's kits. Each read only with its code.
 */
function useFlowRecords(visit: VisitRecord, can: FlowAccess): VisitFlowRecords {
  const { patientId } = usePatientFileContext();
  const { appointmentId } = visit;
  const checks = useVisitChecks(
    { patientId, appointmentId },
    { enabled: can.readsClinical },
  );
  // The cards show these failures in place (their Retry).
  const prescriptions = usePatientPrescriptions(patientId, {
    enabled: can.readsRx,
    notifyOnError: false,
  });
  const treatments = usePatientTreatments(patientId, {
    enabled: can.readsTreatments,
    notifyOnError: false,
  });
  const packages = usePatientPackages(patientId, { enabled: can.readsTreatments });
  const kits = usePrescriptionKits({ enabled: can.rx.writes });
  // The patient's invoices of the visit's day — the visit's own is among them.
  const invoices = useInvoiceList({ patientId, day: visit.booking.date }, can.readsBill);

  const atVisit = (row: { appointmentId: string | null }) =>
    row.appointmentId === appointmentId;
  const sessions = (treatments.data ?? []).filter((row) => row.status === 'done');
  const visitSessions = sessions.filter(atVisit);
  const visitSession = visitSessions[0] ?? null;
  const lastTreatment = sessions.find((row) => !atVisit(row)) ?? null;
  const owned = packages.data ?? [];
  const pack = visitSession
    ? (owned.find((row) => row.id === visitSession.packageId) ?? null)
    : spendablePackage(owned, lastTreatment?.packageId ?? null);

  return {
    checks: can.readsClinical ? readOf(checks, visitChecksOf) : undefined,
    prescription: can.readsRx
      ? readOf(prescriptions, (rows) => rows.find(atVisit) ?? null)
      : undefined,
    treatment: can.readsTreatments ? readOf(treatments, () => visitSession) : undefined,
    lastTreatment,
    pack,
    kits: kits.data ?? [],
    bill: can.readsBill ? billRead(treatments, invoices, visitSessions) : undefined,
  };
}

/** "Visit completed · 1 package session used · follow-up set for 26 Oct", each part only when it happened. */
function useCompletedText(records: VisitFlowRecords): () => string {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { formatDate } = useLocaleFormat();
  return () => {
    const parts = [t(K.completed)];
    if (records.treatment?.data?.packageId) parts.push(t(K.packageUsed));
    const followUp = records.prescription?.data?.followUpDate;
    if (followUp) {
      const date = formatDate(
        localDateOf(followUp),
        { day: 'numeric', month: 'short' },
        { civilDay: true },
      );
      parts.push(t(K.followUp, { date }));
    }
    return parts.join(' · ');
  };
}

/**
 * The visit's own moves (`appointment:update`): Pause (`…/pause`, then out of the flow — the
 * visit stays open), Resume (`…/resume`) and "✓ Complete visit" (`…/complete` — the visit leaves
 * the Overview, which drops its `visit=open`).
 */
function useVisitMoves({
  visit,
  records,
  can,
  flow,
}: FlowBase): Pick<VisitFlowActions, 'pause' | 'resume' | 'complete'> {
  const setPaused = useSetVisitPaused();
  const completedText = useCompletedText(records);
  const complete = useMoveAppointment({ announce: completedText });
  if (!can.movesVisit) return {};
  const { appointmentId } = visit;
  const paused = visit.pausedAt !== null;
  return {
    pause: paused
      ? undefined
      : () =>
          setPaused.mutate(
            { appointmentId, paused: true },
            { onSuccess: flow.leaveFlow },
          ),
    resume: paused ? () => setPaused.mutate({ appointmentId, paused: false }) : undefined,
    complete: () =>
      complete.mutate({
        appointment: { ...visit.booking, doctor: null },
        route: 'complete',
      }),
  };
}

/**
 * Prescription and Treatment: a kit's Rx in one tap and "Write prescription" (the Rx gate), "⚡
 * Repeat" and "New treatment" (the treatments gate) — the treatment waiting for the checks
 * ("Finish check-in first"). Each record written here moves the visit on (Q8).
 */
function useRecordActions({
  visit,
  records,
  can,
  flow,
}: FlowBase): Pick<
  VisitFlowActions,
  'prescribeKit' | 'writeRx' | 'repeatTreatment' | 'newTreatment'
> {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const navigate = useClinicNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const createRx = useCreatePrescription();
  const createTreatment = useCreateTreatment();
  const doctor = useDefaultStaff('doctor', visit.booking.doctorId);
  const { appointmentId } = visit;
  // The drawers keep the flow open behind them and close back to it.
  const inFlow = visitFlowSearch(flow.fromToday ? 'today' : undefined);
  // Unreadable checks gate nothing; checks still loading are not done yet.
  const checks = records.checks?.data;
  const checked =
    records.checks === undefined ||
    (checks !== undefined && Object.values(checks).every(Boolean));
  const whenChecked = (run: () => void) => () => {
    if (checked) run();
    else notify.info(t(K.treatment.blocked));
  };
  const toNewTreatment = () =>
    void navigate({
      ...organizationTreatmentCreate(organizationSlug, patientId),
      search: inFlow,
    });
  const { lastTreatment, pack } = records;

  const prescribeKit = (doctorId: string) => (kit: PrescriptionKit) =>
    createRx.mutate(
      {
        patientId,
        appointmentId,
        approve: can.rx.approves,
        fields: {
          doctorId,
          date: clinicToday(),
          items: kit.items,
          advice: null,
          labReport: null,
          procedureToday: null,
        },
      },
      {
        onSuccess: () => {
          flow.advanceAfter('prescription');
          notify.success(t(K.rx.prescribed, { name: kit.name }));
        },
      },
    );

  const repeat = (last: TreatmentRecord) =>
    createTreatment.mutate(
      { patientId, input: repeatedSession(last, pack, appointmentId) },
      {
        onSuccess: (saved) => {
          flow.advanceAfter('treatment');
          notify.success(t(K.treatment.repeated, { session: saved.sessionNumber }));
        },
      },
    );

  return {
    prescribeKit: can.rx.writes && doctor.id ? prescribeKit(doctor.id) : undefined,
    writeRx: can.rx.writes
      ? () =>
          void navigate({
            ...organizationPrescriptionCreate(organizationSlug, patientId),
            search: inFlow,
          })
      : undefined,
    // Once the visit has its session, a second one is a new treatment, not the last again.
    repeatTreatment:
      can.treats && lastTreatment && !records.treatment?.data
        ? whenChecked(() => repeat(lastTreatment))
        : undefined,
    newTreatment: can.treats ? whenChecked(toNewTreatment) : undefined,
  };
}

/**
 * Invoice and Collect (D156; `payment:create`): "Create invoice from visit" opens the Invoice
 * drawer on the visit's sessions still to bill (`?appointment=`) — "Nothing to bill" when it has
 * none — and "Custom invoice" on the patient alone, until the visit has its invoice; "Collect ₹X"
 * opens Receive payment against that invoice while it owes. Each drawer opens over the flow and
 * closes back into it.
 */
function useMoneyActions({
  visit,
  records,
  can,
  flow,
}: FlowBase): Pick<VisitFlowActions, 'createInvoice' | 'customInvoice' | 'collect'> {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const navigate = useClinicNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const bill = records.bill?.data;
  if (!(can.readsBill && can.bills && bill)) return {};
  const referrer = visitFlowReferrer(patientId, flow.fromToday);
  const newInvoice = (search: Record<string, string>) =>
    void navigate(
      clinicCommandNavigation('newInvoice', {
        organizationSlug,
        referrer,
        search: { type: 'clinic', patient: patientId, ...search },
      }),
    );
  const { invoice } = bill;
  if (invoice) {
    return {
      collect:
        invoice.due > 0
          ? () =>
              void navigate(
                clinicCommandNavigation('newReceipt', {
                  organizationSlug,
                  referrer,
                  search: { patient: patientId, invoice: invoice.id },
                }),
              )
          : undefined,
    };
  }
  return {
    createInvoice: () => {
      if (bill.toBill.length === 0) {
        notify.info(t(K.invoice.nothing));
        return;
      }
      newInvoice({ appointment: visit.appointmentId });
    },
    customInvoice: () => newInvoice({}),
  };
}

/** Tick or untick a safety check — one note per check at the visit. */
function useCheckActions({
  visit,
  records,
  can,
}: FlowBase): Pick<VisitFlowActions, 'toggleCheck' | 'checkSaving'> {
  const { patientId } = usePatientFileContext();
  const setCheck = useSetVisitCheck({ patientId, appointmentId: visit.appointmentId });
  const checks = records.checks?.data;
  // A tick's note has no id until the server answers.
  const checkSaving = (check: VisitCheck) => checks?.[check]?.id === '';
  return {
    checkSaving,
    toggleCheck:
      can.writesChecks && checks
        ? (check) => {
            if (checkSaving(check)) return;
            setCheck.mutate({ check, noteId: checks[check]?.id ?? null });
          }
        : undefined,
  };
}

/**
 * The visit flow (KICKOFF §6.6 Visit flow; H:4871–4898) on clinozy-be: the visit's records — its
 * safety checks, the Rx and the session written at it, its invoice — and what the member may do
 * with them, each toasting in the flow's words.
 */
export function useVisitFlow(visit: VisitRecord): {
  records: VisitFlowRecords;
  actions: VisitFlowActions;
} {
  const can = useFlowAccess();
  const records = useFlowRecords(visit, can);
  const flow = useVisitFlowReturn();
  const base = { visit, records, can, flow };
  return {
    records,
    actions: {
      ...useCheckActions(base),
      ...useRecordActions(base),
      ...useVisitMoves(base),
      ...useMoneyActions(base),
    },
  };
}
