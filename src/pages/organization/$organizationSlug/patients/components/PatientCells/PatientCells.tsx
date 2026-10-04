import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { patientName, type PatientRow } from '@/shared/api/clinic/patients-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import {
  AvatarStack,
  IdPill,
  MoneyCell,
  PersonChip,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import {
  ContactCard,
  type ContactCardActions,
  type ContactCardData,
} from '@/shared/components/PersonCard/index.ts';
import { useDayTime } from '@/shared/hooks/useDayTime/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PATIENTS_KEYS, PATIENTS_NS } from '../../patients.constants.ts';
import { FOLLOW_UP_TONES, followUpWhen, patientAge } from './patient-cells.ts';

/** The ID cell: "#3508" on the 22px grey pill. */
export function PatientIdCell({ seq }: { seq: number }) {
  return <IdPill>{displayId.patient(seq)}</IdPill>;
}

/** One table badge (24px) per value, in each value's tone; wraps when the column is narrow. */
export function PatientBadges({
  badges,
  dot = false,
}: {
  badges: readonly { id: string; label: string; tone: Tone }[];
  dot?: boolean;
}) {
  if (badges.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {badges.map((badge) => (
        <TonePill key={badge.id} tone={badge.tone} dot={dot}>
          {badge.label}
        </TonePill>
      ))}
    </span>
  );
}

/** What the person card shows of a patient row (the schema's `contactCard`, S:1566). */
function useContactCardData(patient: PatientRow, today: string): ContactCardData {
  const { t } = useTranslation(CLINIC_NS);
  return {
    kind: 'patient',
    name: patientName(patient),
    displayId: displayId.patient(patient.seq),
    since: patient.createdAt,
    tags: patient.types.map((type) => t(CLINIC_KEYS.patients.types[type])),
    reach: [
      { channel: 'whatsapp', phone: patient.phone },
      ...(patient.phone2 ? [{ channel: 'phone' as const, phone: patient.phone2 }] : []),
    ],
    about: {
      gender: patient.gender,
      age: patientAge(patient.dateOfBirth, today),
      area: patient.address,
      source: patient.referralSource
        ? t(CLINIC_KEYS.patients.referralSources[patient.referralSource])
        : null,
      owedByThem: patient.dueTotal,
      consent: {
        data: patient.consents.includes('data'),
        photos: patient.consents.includes('photos'),
        marketing: patient.consents.includes('marketing'),
      },
    },
  };
}

/**
 * The Patient cell: the 32px sage avatar with the "P" badge, the name 13px/500
 * over the mobile "+91 82006 03212" — hovering it (a tap on touch) opens the
 * contact card (280 / 220ms, §3.5).
 */
export function PatientNameCell({
  patient,
  today,
  actions,
}: {
  patient: PatientRow;
  today: string;
  actions: ContactCardActions;
}) {
  const data = useContactCardData(patient, today);
  return (
    <ContactCard data={data} {...actions}>
      <PersonChip
        name={data.name}
        sub={formatClinicPhone(patient.phone)}
        tone="sage"
        patient
      />
    </ContactCard>
  );
}

/** The Age cell: "28 yrs" over the birth date "27 Oct 1995", or "—". */
export function PatientAgeCell({
  dateOfBirth,
  today,
}: {
  dateOfBirth: string | null;
  today: string;
}) {
  const { t } = useTranslation(PATIENTS_NS);
  const { formatDate } = useLocaleFormat();
  const age = patientAge(dateOfBirth, today);
  if (age === null || !dateOfBirth) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex min-w-0 flex-col leading-[1.3]">
      <span className="truncate tabular-nums">
        {t(PATIENTS_KEYS.table.age, { count: age })}
      </span>
      <span className="text-caption text-muted-foreground truncate tabular-nums">
        {formatDate(
          localDateOf(dateOfBirth),
          { day: 'numeric', month: 'short', year: 'numeric' },
          { civilDay: true },
        )}
      </span>
    </span>
  );
}

/** The Follow-up cell: "Sep 24 · 14:50" — blush when past, butter today, sky ahead. */
export function PatientFollowUpCell({
  followUpAt,
  today,
}: {
  followUpAt: string | null;
  today: string;
}) {
  const dayTime = useDayTime();
  if (!followUpAt) return null;
  return (
    <TonePill tone={FOLLOW_UP_TONES[followUpWhen(followUpAt, today)]}>
      <span className="tabular-nums">{dayTime(followUpAt)}</span>
    </TonePill>
  );
}

/** The Due cell: "₹2,000" 600 in the blush ink at the inline end, or a muted "—". */
export function PatientDueCell({ dueTotal }: { dueTotal: number }) {
  if (dueTotal <= 0) return <span className="text-muted-foreground">—</span>;
  return (
    <MoneyCell paise={dueTotal} className="text-tone-blush-foreground font-semibold" />
  );
}

/** The Updated cell: who last saved the record in a 28px pill ("Riya S."), then "Sep 24 · 15:39". */
export function PatientUpdatedCell({ patient }: { patient: PatientRow }) {
  const dayTime = useDayTime();
  return (
    <span className="flex min-w-0 items-center gap-2">
      {patient.updatedBy ? (
        <AvatarStack
          nameFirst
          people={[
            {
              id: patient.updatedBy.id,
              name: patient.updatedBy.name,
              initials: patient.updatedBy.initials,
              tone: patient.updatedBy.tone,
            },
          ]}
          className="min-w-0 flex-none"
        />
      ) : null}
      <span
        className={cn(
          'text-caption text-muted-foreground min-w-0 truncate tabular-nums',
          !patient.updatedBy && 'text-body',
        )}
      >
        {dayTime(patient.updatedAt)}
      </span>
    </span>
  );
}
