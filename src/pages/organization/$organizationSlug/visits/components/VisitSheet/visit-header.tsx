import { Dialog as DialogPrimitive } from 'radix-ui';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { civilYearsBetween, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { VisitDetail, VisitPatient } from '@/shared/api/clinic/visits-contracts.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { consentMark, maskVisitPhone, VISIT_CONSENTS } from '../../visits.person.ts';

const K = VISIT_KEYS;
const ids = VISIT_TEST_IDS;

/** A header chip (`today.md:134`): 12px, padding 2px 9px, radius 6px, a 1px line. */
const CHIP = 'rounded-md border px-2.25 py-0.5';

/** The band's buttons (12.5px, padding 6px 12px, radius 8px) — 44px and full width on a phone. */
const BAND_BUTTON =
  'text-detail bg-transparent hover:bg-muted rounded-lg border px-3 py-1.5 transition-colors max-md:h-11 max-md:flex-1';

/** The kind pill's line and ink: a registered patient sage, a lead lav. */
const KIND_PILL = {
  patient: 'border-tone-sage-border text-tone-sage-foreground',
  lead: 'border-tone-lav-border text-tone-lav-foreground',
} as const;

/** Props of {@link VisitHeader}. */
export interface VisitHeaderProps {
  /** Null while the visit loads — the band's bars. */
  detail: VisitDetail | null;
  /** The name heading — focused when the sheet opens. */
  nameRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
  /** "Full profile" — none for a lead's visit (no file yet). */
  onProfile?: () => void;
}

/** The meta line: "F · 29 · PT-0412 · +91 98250 ··· 41" — each part only when known. */
function useMeta(patient: VisitPatient | null): string {
  const { t } = useTranslation(VISIT_NS);
  if (!patient) return '';
  const age = patient.dateOfBirth
    ? String(civilYearsBetween(patient.dateOfBirth, clinicToday()))
    : null;
  return [
    patient.gender ? t(K.gender[patient.gender]) : null,
    age,
    displayId.patientCode(patient.seq),
    maskVisitPhone(patient.phone),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Line 1: the name (the dialog's title), the meta line and the kind pill. */
function HeaderTitle({
  detail,
  nameRef,
}: {
  detail: VisitDetail;
  nameRef: Ref<HTMLHeadingElement>;
}) {
  const { t } = useTranslation(VISIT_NS);
  const meta = useMeta(detail.patient);
  const kind = detail.patient ? 'patient' : 'lead';
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <DialogPrimitive.Title
        ref={nameRef}
        tabIndex={-1}
        data-testid={ids.name}
        className="font-heading text-[1.3125rem] leading-none font-semibold tracking-[-0.02em] outline-none"
      >
        {detail.person.name}
      </DialogPrimitive.Title>
      {meta ? (
        <span
          data-testid={ids.meta}
          className="text-detail text-foreground-soft tabular-nums"
        >
          {meta}
        </span>
      ) : null}
      <span
        data-slot="pill"
        className={cn('text-micro rounded-full border px-2 py-px', KIND_PILL[kind])}
      >
        {t(K.kind[kind])}
      </span>
    </div>
  );
}

/**
 * Line 2: the chips — the package ("Laser pack · 3 of 6 left"), what is due,
 * the consents and the visit's stage since when — each only when its data is
 * there. The allergy chip waits for a schema field (Appendix F).
 */
function HeaderChips({ detail }: { detail: VisitDetail }) {
  const { t } = useTranslation(VISIT_NS);
  const clock = useClinicClock();
  const formatPaise = usePaiseFormat();
  const { pack, patient } = detail;
  const due = detail.previousDue.amount + (detail.invoice ? detail.billDue : 0);
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {pack ? (
        <span
          data-testid={ids.chip}
          data-chip="pack"
          className={cn(
            CHIP,
            'bg-channel-whatsapp-tint border-tone-sage-border text-tone-sage-foreground',
          )}
        >
          {t(K.chips.pack, {
            name: pack.name,
            left: pack.sessionsTotal - pack.sessionsUsed,
            total: pack.sessionsTotal,
          })}
        </span>
      ) : null}
      {due > 0 ? (
        <span
          data-testid={ids.chip}
          data-chip="due"
          className={cn(
            CHIP,
            'bg-tone-butter-tint border-tone-butter-border text-tone-butter-foreground',
          )}
        >
          {t(K.chips.due, { amount: formatPaise(due) })}
        </span>
      ) : null}
      {patient ? (
        <span
          data-testid={ids.chip}
          data-chip="consent"
          className={cn(CHIP, 'text-foreground-soft')}
        >
          {t(K.chips.consent, {
            data: consentMark(patient.consents, VISIT_CONSENTS[0]),
            photos: consentMark(patient.consents, VISIT_CONSENTS[1]),
            marketing: consentMark(patient.consents, VISIT_CONSENTS[2]),
          })}
        </span>
      ) : null}
      <span
        data-testid={ids.chip}
        data-chip="stage"
        className={cn(CHIP, 'text-foreground-soft')}
      >
        {t(K.chips.stage, {
          stage: t(K.stages[detail.visit.stage]),
          time: clock.time(detail.visit.stageAt),
        })}
      </span>
    </div>
  );
}

/**
 * The Visit sheet's header band (KICKOFF §6.13; `today.md:134, 246–248`;
 * H:2471–2486): butter, the name (the dialog's title, focused on open) with
 * the meta line and the kind pill, then the chips; "Full profile" and "Close ·
 * Esc" at the inline end, no ×. While the visit loads, bars.
 */
export function VisitHeader({ detail, nameRef, onClose, onProfile }: VisitHeaderProps) {
  const { t } = useTranslation(VISIT_NS);
  return (
    <div className="bg-tone-butter flex items-start gap-4.5 border-b px-5.5 pt-3.5 pb-3 max-md:flex-col max-md:gap-3 max-md:p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-md:w-full">
        {detail ? (
          <>
            <HeaderTitle detail={detail} nameRef={nameRef} />
            <HeaderChips detail={detail} />
          </>
        ) : (
          <>
            <DialogPrimitive.Title className="sr-only">
              {t(K.loading)}
            </DialogPrimitive.Title>
            <SkeletonBar index={1} className="h-5 w-40" />
            <SkeletonBar index={2} className="h-5 max-w-80" />
          </>
        )}
      </div>
      <div className="flex flex-none gap-1.5 max-md:w-full max-md:flex-wrap">
        {onProfile ? (
          <button
            type="button"
            onClick={onProfile}
            data-testid={ids.fullProfile}
            className={cn(BAND_BUTTON, 'font-medium shadow-(--elevation-control)')}
          >
            {t(K.fullProfile)}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          data-testid={ids.close}
          className={BAND_BUTTON}
        >
          {t(K.close)}
        </button>
      </div>
    </div>
  );
}
