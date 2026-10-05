import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicInstant, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { ChatPerson } from '@/shared/api/clinic/messages-contracts.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import {
  useBookableStaff,
  usePatientAppointments,
} from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { usePatientPhotos } from '@/shared/hooks/usePatientPhotos/index.ts';
import {
  usePatientInvoices,
  usePatientPayments,
} from '@/shared/hooks/usePayments/index.ts';
import { usePatientPrescriptions } from '@/shared/hooks/usePrescriptions/index.ts';
import { useThread } from '@/shared/hooks/useThread/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';

import {
  VISIT_KEYS,
  VISIT_NS,
  type VisitHistoryFilter,
  type VisitHistoryKind,
} from '../../visits.constants.ts';

const K = VISIT_KEYS.history;

/** The filter each kind belongs to (`TIMELINE` H:3502–3512). */
export const HISTORY_FILTER_OF: Readonly<
  Record<VisitHistoryKind, Exclude<VisitHistoryFilter, 'all'>>
> = {
  visit: 'clinical',
  consult: 'clinical',
  session: 'clinical',
  photo: 'clinical',
  invoice: 'money',
  payment: 'money',
  package: 'money',
  message: 'messages',
  lead: 'messages',
  change: 'audit',
};

/** One History row: when it happened, its kind and its line. */
export interface VisitHistoryRow {
  id: string;
  kind: VisitHistoryKind;
  /** The instant it sorts by — a record with a day only sorts at 09:00. */
  at: string;
  /** "Today 10:40" · "12 Aug 2026". */
  when: string;
  text: string;
}

/** The hour a record with a day only sorts at (the Overview's, H:4839). */
const DAY_ONLY_AT = '09:00';

/** Newest first (ISO instants compare as text). */
const newestFirst = (a: VisitHistoryRow, b: VisitHistoryRow) => b.at.localeCompare(a.at);

/** The person's thread: the patient's, else the enquiry's. */
function threadOf({ patientId, leadId }: VisitDetail['person']): ChatPerson {
  return patientId
    ? { kind: 'patient', patientId }
    : { kind: 'lead', leadId: leadId ?? '' };
}

/**
 * The patient's records the History reads — the same reads as the Overview's
 * timeline; the money ones only with Payments view, private photos only for
 * the roles their album allows (`S:40`), and a lead's own thread.
 */
function useHistoryReads(detail: VisitDetail) {
  const access = useClinicAccess();
  const patientId = detail.person.patientId ?? '';
  const billing = access.isResolved && access.can('payments', 'view');
  const privateAlbum =
    access.isResolved && passesPatientFileGate(access.roles, 'privateAlbum');
  const visits = usePatientAppointments(patientId);
  const prescriptions = usePatientPrescriptions(patientId);
  const treatments = usePatientTreatments(patientId);
  const photos = usePatientPhotos(patientId, { privateAlbum });
  const packages = usePatientPackages(patientId, { enabled: billing });
  const invoices = usePatientInvoices(billing && patientId ? patientId : null);
  const payments = usePatientPayments(billing ? patientId : '');
  const thread = useThread(threadOf(detail.person));
  const money = <T>(rows: T[] | undefined): T[] => (billing ? (rows ?? []) : []);
  return {
    visits: visits.data ?? [],
    prescriptions: prescriptions.data ?? [],
    treatments: treatments.data ?? [],
    photos: photos.data?.photos ?? [],
    invoices: money(invoices.data),
    payments: money(payments.data),
    packages: money(packages.data),
    messages: (thread.data?.messages ?? []).filter((message) => !message.isSystem),
    loading: [visits, prescriptions, treatments].some(
      (read) => read.isPending && read.fetchStatus !== 'idle',
    ),
  };
}

/**
 * The History tab's rows (KICKOFF §6.13: "the patient's activity — one source
 * with the patient file's Overview timeline, filtered by role"): the same
 * records the Overview merges — visits, prescriptions, sessions, photos, and
 * with Payments view the invoices, payments and packages — plus the person's
 * messages and the record's own history (the enquiry that became them, the
 * record's creation), newest first.
 */
export function useVisitHistory(detail: VisitDetail): {
  rows: VisitHistoryRow[];
  loading: boolean;
} {
  const { t } = useTranslation([VISIT_NS, CLINIC_NS]);
  const clock = useClinicClock();
  const { formatDate } = useLocaleFormat();
  const formatPaise = usePaiseFormat();
  const staff = useBookableStaff().data ?? [];
  const reads = useHistoryReads(detail);
  const { patient } = detail;

  const nameOf = (id: string | null) => {
    const member = staff.find((candidate) => candidate.id === id);
    return member ? shortPersonName(personFullName(member)) : null;
  };
  /** "Today 10:40" for today's (the time when it has one), else the day with its year ("12 Aug 2026"). */
  const whenOf = (day: string, time: string | null) => {
    if (day === clock.today) return time ? t(K.today, { time }) : t(K.todayOnly);
    return formatDate(
      localDateOf(day),
      { day: '2-digit', month: 'short', year: 'numeric' },
      { civilDay: true },
    );
  };
  const timed = (at: string) => ({ at, when: whenOf(clock.dayOf(at), clock.time(at)) });
  const dayOnly = (day: string) => ({
    at: clinicInstant(day, DAY_ONLY_AT),
    when: whenOf(day, null),
  });

  const rows: VisitHistoryRow[] = [
    ...reads.visits.map((visit) => ({
      id: `visit-${visit.id}`,
      kind: 'visit' as const,
      ...timed(clinicInstant(visit.date, visit.startTime)),
      text: t(K.rows.visit, {
        service: visit.serviceLabel,
        status: t(CLINIC_KEYS.appointments.statuses[visit.status], { ns: CLINIC_NS }),
      }),
    })),
    ...reads.prescriptions.map((rx) => ({
      id: `rx-${rx.id}`,
      kind: 'consult' as const,
      ...dayOnly(rx.date),
      text: [
        nameOf(rx.doctorId),
        rx.advice,
        t(K.rows.consult, {
          number: displayId.prescription(rx.seq),
          count: rx.items.length,
        }),
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    ...reads.treatments.map((treatment) => ({
      id: `session-${treatment.id}`,
      kind: 'session' as const,
      ...timed(treatment.performedAt),
      text: [
        t(K.rows.session, { name: treatment.name, session: treatment.sessionNo }),
        nameOf(treatment.therapistId),
        ...Object.entries(treatment.params)
          .filter(([key]) => key !== 'type' && key !== 'areas')
          .map(([, value]) => value),
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    ...reads.photos.map((photo) => ({
      id: `photo-${photo.id}`,
      kind: 'photo' as const,
      ...dayOnly(photo.takenOn),
      text: photo.caption ?? photo.fileName,
    })),
    ...reads.invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      kind: 'invoice' as const,
      ...dayOnly(invoice.date),
      text: t(invoice.due > 0 ? K.rows.invoice : K.rows.invoicePaid, {
        type: t(CLINIC_KEYS.invoiceTypes[invoice.type], { ns: CLINIC_NS }),
        number: displayId.invoiceNumber(invoice.seq),
        bill: formatPaise(invoice.bill),
        due: formatPaise(invoice.due),
      }),
    })),
    ...reads.payments.map((payment) => ({
      id: `payment-${payment.id}`,
      kind: 'payment' as const,
      ...timed(payment.paidAt),
      text: t(K.rows.payment, {
        amount: formatPaise(
          payment.direction === 'received' ? payment.amount : -payment.amount,
        ),
        mode: [...new Set(payment.splits.map((split) => split.mode))]
          .map((mode) => t(CLINIC_KEYS.paymentModes[mode], { ns: CLINIC_NS }))
          .join(' + '),
        number: displayId.payment(payment.seq),
      }),
    })),
    ...reads.packages.map((row) => ({
      id: `package-${row.package.id}`,
      kind: 'package' as const,
      ...timed(row.package.createdAt),
      text: t(K.rows.package, {
        name: row.offering?.name ?? '',
        used: row.package.sessionsUsed,
        total: row.package.sessionsTotal,
      }),
    })),
    ...reads.messages.map((message) => ({
      id: `message-${message.id}`,
      kind: 'message' as const,
      ...timed(message.sentAt),
      text: message.body,
    })),
  ];
  if (patient?.leadId) {
    rows.push({
      id: `lead-${patient.leadId}`,
      kind: 'lead',
      ...timed(patient.createdAt),
      text: t(K.rows.lead),
    });
  }
  if (patient) {
    rows.push({
      id: `created-${patient.id}`,
      kind: 'change',
      ...timed(patient.createdAt),
      text: t(K.rows.created),
    });
  }
  return { rows: rows.sort(newestFirst), loading: reads.loading };
}
