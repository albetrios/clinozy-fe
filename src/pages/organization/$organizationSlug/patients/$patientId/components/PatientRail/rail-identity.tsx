import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import {
  patientName,
  type PatientRecord,
} from '@/shared/api/clinic/patients-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  PATIENT_STATUS_TONES,
  PATIENT_TYPE_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { PenLine } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PATIENT_RAIL_KEYS, PATIENT_RAIL_NS } from './patient-rail.constants.ts';
import { patientTenure } from './patient-rail.ts';

const K = PATIENT_RAIL_KEYS;

/** "45 days as patient" / "1 day as patient" / "3 months as patient" / "Joined today". */
function useTenureLine(patient: PatientRecord): { line: string; since: string } {
  const { t } = useTranslation(PATIENT_RAIL_NS);
  const { formatDate } = useLocaleFormat();
  const today = clinicToday();
  const joined = clinicToday(new Date(patient.createdAt));
  const tenure = patientTenure(joined, today);
  let line = t(K.joinedToday);
  if (tenure.kind === 'days') line = t(K.daysAsPatient, { count: tenure.count });
  if (tenure.kind === 'months') line = t(K.monthsAsPatient, { count: tenure.count });
  const since = t(K.since, {
    date: formatDate(
      localDateOf(joined),
      { day: 'numeric', month: 'short', year: 'numeric' },
      { civilDay: true },
    ),
  });
  return { line, since };
}

/**
 * The rail's fixed top (H:713–716): the 48px sage avatar with the "P" badge,
 * the name, "#3508" (copies), the tenure, the type and status pills — on the
 * sage tint — and "Edit contact".
 */
export function RailIdentity({
  patient,
  onEditContact,
}: {
  patient: PatientRecord;
  /** "Edit contact" — hidden without Patients edit. */
  onEditContact?: () => void;
}) {
  const { t } = useTranslation([PATIENT_RAIL_NS, CLINIC_NS, ERRORS_NS]);
  const name = patientName(patient);
  const id = displayId.patient(patient.seq);
  const { line, since } = useTenureLine(patient);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      notify.success(t(K.idCopied));
    } catch {
      notify.error(t(ERRORS_KEYS.frontend.account.copyFailed, { ns: ERRORS_NS }));
    }
  };

  return (
    <div className="bg-tone-sage-tint grid flex-none grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3.5 border-b py-4.5 ps-4.5 pe-3">
      <PersonAvatar size="card" tone="sage" patient initials={personInitials(name)} />
      <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
        <span className="text-base leading-[1.2] font-semibold tracking-[-0.015em] wrap-anywhere">
          {name}
        </span>
        <span className="text-caption text-muted-foreground-strong flex flex-wrap items-center gap-1.5 tabular-nums">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void copyId()}
                aria-label={`${t(K.copyId)} · ${id}`}
                data-testid="patient-rail-copy-id"
                className="text-tone-sage-foreground font-semibold hover:underline"
              >
                {id}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t(K.copyId)}</TooltipContent>
          </Tooltip>
          <span aria-hidden="true" className="text-border-strong">
            ·
          </span>
          <span title={since}>{line}</span>
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {patient.types.map((type) => (
            <TonePill key={type} tone={PATIENT_TYPE_TONES[type]} size="sm">
              {t(CLINIC_KEYS.patients.types[type], { ns: CLINIC_NS })}
            </TonePill>
          ))}
          <TonePill tone={PATIENT_STATUS_TONES[patient.status]} size="sm">
            {t(CLINIC_KEYS.patients.statuses[patient.status], { ns: CLINIC_NS })}
          </TonePill>
        </div>
      </div>
      {onEditContact ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onEditContact}
              aria-label={t(K.editContact)}
              data-testid="patient-rail-edit"
              className="text-muted-foreground-strong hover:bg-foreground/6 hover:text-foreground flex size-7 items-center justify-center rounded-lg transition-colors"
            >
              <PenLine aria-hidden="true" className="size-3.75" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t(K.editContact)}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
