import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import {
  organizationPatientSection,
  organizationPrescriptionEdit,
  organizationTreatmentEdit,
} from '@/lib/routes/patient-file-builders.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicDateOf } from '@/shared/api/clinic/clinic-filter-match.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { photoName } from '@/shared/api/clinic/patient-images-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { personFullName } from '@/shared/components/Cells/index.ts';
import { usePatientAppointments } from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePatientNotes } from '@/shared/hooks/usePatientNotes/index.ts';
import { usePatientPhotos } from '@/shared/hooks/usePatientPhotos/index.ts';
import {
  usePatientInvoices,
  usePatientPayments,
} from '@/shared/hooks/usePayments/index.ts';
import { usePatientPrescriptions } from '@/shared/hooks/usePrescriptions/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';

import { useStaffLookup } from '../../../shared/hooks/useStaffLookup/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { TIMELINE_KEYS, TIMELINE_NS } from '../../timeline.constants.ts';
import type { ActivityEntry } from './activity-feed.ts';

const K = TIMELINE_KEYS.activity;

/** The hour a record with a day only sorts at (H:4839). */
const DAY_ONLY_AT = '09:00';

/** A visit status's badge tone (H:4856): Completed sage, Cancelled / No-show blush, else sky. */
function visitTone(status: string) {
  if (status === 'completed') return 'sage' as const;
  if (status === 'cancelled' || status === 'no_show') return 'blush' as const;
  return 'sky' as const;
}

/** An instant's clinic day, the instant, and its clock time. */
function useTimed() {
  const { formatDate, prefs } = useLocaleFormat();
  return (instant: string) => ({
    day: clinicDateOf(instant),
    at: instant,
    time: formatDate(instant, {
      ...dateFormatOptions('time', prefs.hourCycle),
      hour: 'numeric',
      second: undefined,
    }),
  });
}

/** A record with a day only: sorted at 09:00 that day, no time shown. */
const dayOnly = (day: string) => ({
  day,
  at: clinicInstant(day, DAY_ONLY_AT),
  time: null,
});

/**
 * The Overview's activity feed (KICKOFF §6.6 Activity timeline, D19; H:4840–
 * 4864): every record of the patient — visits, prescriptions, treatments,
 * invoices and payments (with billing view), photos and notes — as one list
 * in the viewer's words, money masked with the file, each opening its
 * record. One merged feed is a backend request (it also gives the Activity
 * column its system pills); until then the sections' reads are merged here.
 */
export function useActivityFeed(): { entries: ActivityEntry[]; loading: boolean } {
  const { t } = useTranslation([TIMELINE_NS, CLINIC_NS]);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, viewable, masked } = usePatientFileContext();
  const access = useClinicAccess();
  const staff = useStaffLookup();
  const timed = useTimed();
  const formatPaise = usePaiseFormat();
  const billing = viewable.includes('invoices');
  const privateAlbum =
    access.isResolved && passesPatientFileGate(access.roles, 'privateAlbum');
  const visits = usePatientAppointments(patientId);
  const prescriptions = usePatientPrescriptions(patientId);
  const treatments = usePatientTreatments(patientId);
  const invoices = usePatientInvoices(billing ? patientId : null);
  const payments = usePatientPayments(billing ? patientId : '');
  const photos = usePatientPhotos(patientId, { privateAlbum });
  const notes = usePatientNotes(patientId);
  const money = (paise: number) =>
    masked ? t(TIMELINE_KEYS.billing.masked) : formatPaise(paise);
  const section = (target: 'visits' | 'payments' | 'notes') => () =>
    void navigate(organizationPatientSection(organizationSlug, patientId, target));
  const referrer = `patients/${patientId}/timeline`;

  const entries: ActivityEntry[] = [
    ...(visits.data ?? []).map((visit) => ({
      id: `visit-${visit.id}`,
      kind: 'visit' as const,
      ...timed(clinicInstant(visit.date, visit.startTime)),
      title: visit.serviceLabel,
      sub: '',
      badge: {
        label: t(CLINIC_KEYS.appointments.statuses[visit.status], { ns: CLINIC_NS }),
        tone: visitTone(visit.status),
      },
      by: visit.doctor
        ? {
            id: visit.doctor.id,
            name: personFullName(visit.doctor),
            initials: visit.doctor.initials,
            tone: visit.doctor.tone,
          }
        : null,
      open: section('visits'),
    })),
    ...(prescriptions.data ?? []).map((rx) => ({
      id: `rx-${rx.id}`,
      kind: 'rx' as const,
      ...dayOnly(rx.date),
      title: t(K.rx, {
        number: displayId.prescription(rx.seq),
        medicines: rx.items.map((item) => item.medicineName).join(', '),
      }),
      sub: rx.advice ?? t(K.medicines, { count: rx.items.length }),
      badge: null,
      by: staff(rx.doctorId),
      open: () =>
        void navigate(organizationPrescriptionEdit(organizationSlug, patientId, rx.id)),
    })),
    ...(treatments.data ?? []).map((treatment) => ({
      id: `treat-${treatment.id}`,
      kind: 'treat' as const,
      ...timed(treatment.performedAt),
      title: t(K.treatment, { name: treatment.name, session: treatment.sessionNo }),
      sub: t(K.templates[treatment.template]),
      badge: null,
      by: staff(treatment.doctorId),
      open: () =>
        void navigate(
          organizationTreatmentEdit(organizationSlug, patientId, treatment.id),
        ),
    })),
    ...(billing ? (invoices.data ?? []) : []).map((invoice) => ({
      id: `inv-${invoice.id}`,
      kind: 'inv' as const,
      ...dayOnly(invoice.date),
      title: t(TIMELINE_KEYS.billing.invoice, {
        type: t(CLINIC_KEYS.invoiceTypes[invoice.type], { ns: CLINIC_NS }),
        number: displayId.invoiceNumber(invoice.seq),
      }),
      sub: '',
      badge:
        invoice.due > 0
          ? { label: t(K.due, { amount: money(invoice.due) }), tone: 'blush' as const }
          : {
              label: t(CLINIC_KEYS.invoiceStatuses.paid, { ns: CLINIC_NS }),
              tone: 'sage' as const,
            },
      by: staff(invoice.teamIds[0]),
      open: () =>
        void navigate(
          clinicCommandNavigation(
            access.isResolved && access.can('payments', 'edit')
              ? 'invoiceEdit'
              : 'invoice',
            { organizationSlug, recordId: invoice.id, referrer },
          ),
        ),
    })),
    ...(billing ? (payments.data ?? []) : []).map((payment) => {
      const mode = [...new Set(payment.splits.map((split) => split.mode))]
        .map((one) => t(CLINIC_KEYS.paymentModes[one], { ns: CLINIC_NS }))
        .join(' + ');
      return {
        id: `pay-${payment.id}`,
        kind: 'pay' as const,
        ...timed(payment.paidAt),
        title: t(payment.direction === 'received' ? K.received : K.refund, {
          amount: money(payment.amount),
          mode,
        }),
        sub: payment.invoice
          ? t(K.against, { number: displayId.invoiceNumber(payment.invoice.seq) })
          : '',
        badge: null,
        by: payment.by,
        open: section('payments'),
      };
    }),
    ...(photos.data?.photos ?? []).map((photo) => ({
      id: `photo-${photo.id}`,
      kind: 'photo' as const,
      ...dayOnly(photo.takenOn),
      title: photoName(photo),
      sub: t(TIMELINE_KEYS.photos.albums[photo.album]),
      badge: null,
      by: staff(photo.createdById),
      fileUrl: photo.fileUrl,
      open: () =>
        void navigate({
          ...organizationPatientSection(organizationSlug, patientId, 'images'),
          search: photo.album === 'general' ? {} : { album: photo.album },
        }),
    })),
    ...(notes.data ?? []).map((note) => ({
      id: `note-${note.id}`,
      kind: 'note' as const,
      ...timed(note.createdAt),
      title: note.body,
      sub: '',
      badge: null,
      by: staff(note.createdById),
      open: section('notes'),
    })),
  ];

  const loading = [visits, prescriptions, treatments, photos, notes].some(
    (read) => read.isPending,
  );
  return { entries, loading };
}
