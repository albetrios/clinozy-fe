import { useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationPrescriptionCreate,
  organizationTreatmentCreate,
} from '@/lib/routes/patient-file-builders.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { visitQueryKeys } from '@/shared/api/clinic/visits-api.ts';
import type {
  VisitCheck,
  VisitCompletion,
  VisitDetail,
  VisitPaymentMode,
  VisitRecord,
  VisitRxKit,
} from '@/shared/api/clinic/visits-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { visitFlowReferrer } from '@/shared/clinic/clinic-referrer.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useOpenInvoices, useReceivePayment } from '@/shared/hooks/usePayments/index.ts';
import { useCreatePrescription } from '@/shared/hooks/usePrescriptions/index.ts';
import { useCreateTreatment } from '@/shared/hooks/useTreatments/index.ts';
import {
  useCompleteVisit,
  useCreateVisitBill,
  useSetVisitChecks,
  useShareVisit,
} from '@/shared/hooks/useVisits/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useDefaultStaff } from '../../../shared/components/PatientStaffPicker/index.ts';
import {
  useVisitFlowReturn,
  visitFlowSearch,
} from '../../../shared/hooks/useVisitFlowReturn/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { TIMELINE_KEYS } from '../../timeline.constants.ts';
import { VISIT_FLOW_KEYS, VISIT_FLOW_NS } from './visit-flow.constants.ts';
import { repeatedSession } from './visit-flow.ts';

const K = VISIT_FLOW_KEYS;

/** What the flow may do and runs — each action left out when the member can't. */
export interface VisitFlowActions {
  toggleCheck: (check: VisitCheck) => void;
  /** One tap from a kit saves an Rx (Doctor / Admin, `S:35`). */
  prescribeKit?: (kit: VisitRxKit) => void;
  writeRx?: () => void;
  /** "⚡ Repeat" — the last session again, one session on (Doctor / Therapist, `S:38`). */
  repeatTreatment?: () => void;
  newTreatment?: () => void;
  /** "Create invoice from visit" and "Custom invoice" (Payments create, `S:92`). */
  createInvoice?: () => void;
  customInvoice?: () => void;
  /** "Collect ₹<n> · <mode>": the oldest open invoice in full (Payments create). */
  collect?: (mode: VisitPaymentMode) => void;
  share: () => void;
  complete: () => void;
  pause: () => void;
}

/** What each part of the flow's actions reads: the file, the member, the words, the links. */
function useFlowBase() {
  const { t } = useTranslation([VISIT_FLOW_NS, CLINIC_NS]);
  const navigate = useClinicNavigate();
  const queryClient = useQueryClient();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, file, masked } = usePatientFileContext();
  const access = useClinicAccess();
  const formatPaise = usePaiseFormat();
  const flow = useVisitFlowReturn();
  return {
    t,
    navigate,
    organizationSlug,
    patientId,
    file,
    /** The flow's place in the URL: its drawers keep it open, its exits go back to Today when it came from there. */
    flow,
    roles: access.isResolved ? access.roles : [],
    canBill: access.isResolved && access.can('payments', 'create'),
    /** An amount as the file shows it — masked while the file is. */
    money: (paise: number) =>
      masked ? t(TIMELINE_KEYS.billing.masked) : formatPaise(paise),
    /** The flow reads the visit's detail: a write outside the Visit's own refreshes it. */
    refreshVisit: () =>
      void queryClient.invalidateQueries({ queryKey: visitQueryKeys.all }),
  };
}

/** The shared reads every part of the flow's actions starts from. */
type FlowBase = ReturnType<typeof useFlowBase>;

/**
 * The visit's own writes: the safety checks, the share, the end of the visit
 * ("Visit completed · …" — the page then leaves the flow, as for any visit that
 * ends under it: back to the Overview, or Today when Today's card opened the
 * flow) and Pause (the same way out, the visit left open).
 */
function useVisitActions(
  base: FlowBase,
  visit: VisitRecord,
): Pick<VisitFlowActions, 'toggleCheck' | 'share' | 'complete' | 'pause'> {
  const { t, file, flow } = base;
  const { leaveFlow } = flow;
  const { formatDate } = useLocaleFormat();
  const setChecks = useSetVisitChecks();
  const share = useShareVisit();
  const complete = useCompleteVisit({ notifyOnError: true });
  const name = file
    ? [file.patient.firstName, file.patient.lastName].filter(Boolean).join(' ')
    : '';
  const completed = ({ packageSessionUsed, followUpDate }: VisitCompletion) => {
    const parts = [t(K.completed)];
    if (packageSessionUsed) parts.push(t(K.packageUsed));
    if (followUpDate) {
      const date = formatDate(
        localDateOf(followUpDate),
        { day: 'numeric', month: 'short' },
        { civilDay: true },
      );
      parts.push(t(K.followUp, { date }));
    }
    notify.success(parts.join(' · '));
  };
  return {
    toggleCheck: (check) =>
      setChecks.mutate({ visitId: visit.id, checks: { [check]: !visit.checks[check] } }),
    share: () =>
      share.mutate(
        { visitId: visit.id },
        { onSuccess: () => notify.success(t(K.collect.shared, { name })) },
      ),
    complete: () => complete.mutate({ visitId: visit.id }, { onSuccess: completed }),
    pause: leaveFlow,
  };
}

/**
 * Prescription and Treatment: a kit's Rx in one tap and "Write prescription"
 * (the Rx gate), "⚡ Repeat" and "New treatment" (the treatments gate) — both
 * waiting for the checks ("Finish check-in first").
 */
function useClinicalActions(
  base: FlowBase,
  visit: VisitRecord,
  detail: VisitDetail | undefined,
): Pick<
  VisitFlowActions,
  'prescribeKit' | 'writeRx' | 'repeatTreatment' | 'newTreatment'
> {
  const { t, navigate, organizationSlug, patientId, roles, refreshVisit, flow } = base;
  // The drawers keep the flow open behind them and close back to it.
  const inFlow = visitFlowSearch(flow.fromToday ? 'today' : undefined);
  const createRx = useCreatePrescription();
  const createTreatment = useCreateTreatment();
  const doctor = useDefaultStaff('doctor', detail?.booking?.doctorId);
  const ready = Object.values(visit.checks).every(Boolean);
  const prescribes = passesPatientFileGate(roles, 'prescriptions');
  const treats = passesPatientFileGate(roles, 'treatments');
  const toNewTreatment = () =>
    void navigate({
      ...organizationTreatmentCreate(organizationSlug, patientId),
      search: inFlow,
    });
  const whenReady = (run: () => void) => () => {
    if (ready) run();
    else notify.info(t(K.treatment.blocked));
  };

  const repeat = () => {
    const last = detail?.lastTreatment;
    if (!last) {
      toNewTreatment();
      return;
    }
    const input = repeatedSession(last, detail?.pack ?? null, {
      patientId,
      appointmentId: visit.appointmentId,
      performedAt: new Date().toISOString(),
    });
    createTreatment.mutate(input, {
      onSuccess: () => {
        refreshVisit();
        notify.success(t(K.treatment.repeated, { session: input.sessionNo }));
      },
    });
  };

  const prescribeKit = (kit: VisitRxKit) =>
    createRx.mutate(
      {
        patientId,
        appointmentId: visit.appointmentId,
        doctorId: doctor.id ?? '',
        date: clinicToday(),
        items: kit.items,
        advice: null,
        labReport: null,
        procedureToday: null,
        followUpDate: null,
      },
      {
        onSuccess: () => {
          refreshVisit();
          notify.success(t(K.rx.prescribed, { name: kit.name }));
        },
      },
    );

  return {
    prescribeKit: prescribes && doctor.id ? prescribeKit : undefined,
    writeRx: prescribes
      ? () =>
          void navigate({
            ...organizationPrescriptionCreate(organizationSlug, patientId),
            search: inFlow,
          })
      : undefined,
    repeatTreatment: treats ? whenReady(repeat) : undefined,
    newTreatment: treats ? whenReady(toNewTreatment) : undefined,
  };
}

/**
 * Invoice and Collect (Payments create): the visit's invoice from its lines,
 * a custom invoice for this patient — the flow kept behind it — and the oldest
 * open invoice collected in full in one tap.
 */
function useMoneyActions(
  base: FlowBase,
  visit: VisitRecord,
  detail: VisitDetail | undefined,
): Pick<VisitFlowActions, 'createInvoice' | 'customInvoice' | 'collect'> {
  const { t, navigate, organizationSlug, patientId, file, money, refreshVisit, flow } =
    base;
  const createBill = useCreateVisitBill({ notifyOnError: true });
  const receive = useReceivePayment();
  const openInvoices = useOpenInvoices(patientId).data ?? [];
  if (!base.canBill) return {};

  const createInvoice = () => {
    if (!detail || detail.billLines.length === 0) {
      notify.info(t(K.invoice.nothing));
      return;
    }
    createBill.mutate(
      { visitId: visit.id },
      {
        onSuccess: ({ invoice }) =>
          notify.success(
            t(K.invoice.created, { number: displayId.invoiceNumber(invoice.seq) }),
          ),
      },
    );
  };

  const collect = (mode: VisitPaymentMode) => {
    const [invoice] = openInvoices;
    const branchId = file?.patient.homeBranchId;
    if (!(invoice && branchId)) {
      notify.info(t(K.collect.nothing));
      return;
    }
    const received = t(K.collect.received, {
      amount: money(invoice.due),
      mode: t(CLINIC_KEYS.paymentModes[mode], { ns: CLINIC_NS }),
    });
    receive.mutate(
      {
        branchId,
        patientId,
        invoiceId: invoice.id,
        splits: [{ mode, amount: invoice.due }],
        reference: null,
        note: null,
      },
      {
        onSuccess: () => {
          refreshVisit();
          notify.success(received);
        },
      },
    );
  };

  return {
    createInvoice,
    customInvoice: () =>
      void navigate(
        clinicCommandNavigation('newInvoice', {
          organizationSlug,
          referrer: visitFlowReferrer(patientId, flow.fromToday),
          search: { type: 'clinic', patient: patientId },
        }),
      ),
    collect,
  };
}

/**
 * The visit flow's writes and links (KICKOFF §6.6 Visit flow; H:4871–4898), on
 * the D18 Visit and the patient's own record writes: the safety checks, a kit's
 * Rx, the last session repeated, the visit's invoice, a collection, the share,
 * and the end — each toasting in the flow's words. Treatment waits for the
 * checks ("Finish check-in first"); Pause leaves the flow with the visit open.
 */
export function useVisitFlowActions(
  visit: VisitRecord,
  detail: VisitDetail | undefined,
): VisitFlowActions {
  const base = useFlowBase();
  return {
    ...useVisitActions(base, visit),
    ...useClinicalActions(base, visit, detail),
    ...useMoneyActions(base, visit, detail),
  };
}
