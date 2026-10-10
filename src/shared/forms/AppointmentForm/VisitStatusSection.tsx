import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  type AppointmentTile,
  type AppointmentTileStatus,
  formStatusHint,
  formTiles,
} from '@/shared/api/clinic/appointment-status.ts';
import type { AppointmentStatus, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { TONE_CLASSES, type ToneClasses } from '@/shared/clinic/clinic-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { Calendar, Check, Copy, XCircle } from '@/shared/icons/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';

const K = APPOINTMENT_FORM_KEYS.status;
const IDS = APPOINTMENT_FORM_TEST_IDS;
const APPT = CLINIC_KEYS.appointments;

/**
 * The form's tile tones (H:4136, H:6038): Scheduled stone, Confirmed sky,
 * Checked in mint, Completed sage — the list's pills use butter / sky / lav /
 * sage; both as designed (AMBER A-A5).
 */
const APPOINTMENT_TILE_TONES: Readonly<Record<AppointmentTileStatus, Tone>> = {
  scheduled: 'stone',
  confirmed: 'sky',
  checked_in: 'mint',
  completed: 'sage',
};

/** Props for {@link VisitStatusSection}. */
export interface VisitStatusSectionProps {
  /** The saved status — what the tiles' rules and the banner read. */
  saved: AppointmentStatus;
  /** The tiles' pick. */
  draft: AppointmentStatus;
  /** The draft's visit day and today, clinic-local. */
  date: string;
  today: string;
  isPatient: boolean;
  canEdit: boolean;
  onPick: (status: AppointmentStatus) => void;
  /** A blocked Completed: the patient file opens at check-in, so this says to check in first. */
  onNeedsPatient: () => void;
  /** The cancelled banner's reason (a label or the note), `null` without one. */
  cancelReason: string | null;
  onRestore?: () => void;
  restoring: boolean;
  /** The "Rescheduled · was …" note, worded; `null` without a move. */
  rescheduled: string | null;
  /** Copy — or Rebook for a No-show (a new booking either way, Q-A6). */
  onCopy?: () => void;
  onCancelVisit?: () => void;
}

/** A tile's look by its step: current solid in the tone, done on its tint, upcoming plain. */
const TILE_LOOK: Readonly<
  Record<AppointmentTile['step'], (tone: ToneClasses) => string>
> = {
  current: (tone) => cn(tone.fill, 'border-transparent font-semibold'),
  done: (tone) => cn(tone.surface, 'border-transparent font-medium'),
  upcoming: () => 'bg-card font-medium',
};

/** Its number circle's: on the background in the ink, solid ✓, ringed grey. */
const MARK_LOOK: Readonly<
  Record<AppointmentTile['step'], (tone: ToneClasses) => string>
> = {
  current: (tone) => cn('bg-background', tone.ink),
  done: (tone) => tone.fill,
  upcoming: () => 'border-border-strong text-muted-foreground border-[1.5px]',
};

/** A tile's tooltip: Completed's "create the patient record first", else why it waits. */
function tileHint(t: (key: string) => string, tile: AppointmentTile): string | null {
  if (tile.reason === 'needs_patient') return t(APPT.guards.needsPatient);
  if (tile.reason && tile.reason in APPT.tiles) {
    return t(APPT.tiles[tile.reason as keyof typeof APPT.tiles]);
  }
  return null;
}

/** One status tile (H:2757; `flow`, H:4136): done ✓ on the tint, current solid, upcoming ringed. */
function StatusTile({
  tile,
  index,
  inert,
  cancelled,
  onPick,
  onNeedsPatient,
}: {
  tile: AppointmentTile;
  index: number;
  inert: boolean;
  cancelled: boolean;
  onPick: (status: AppointmentStatus) => void;
  onNeedsPatient: () => void;
}) {
  const { t } = useTranslation(CLINIC_NS);
  const tone = TONE_CLASSES[APPOINTMENT_TILE_TONES[tile.status]];
  const blocked = tile.reason === 'needs_patient';
  const live = !inert && (tile.pickable || blocked);
  const current = tile.step === 'current';
  const done = tile.step === 'done';
  const hint = tileHint(t, tile);
  const button = (
    <button // NOSONAR(S6819): styled-button radiogroup; a native radio input cannot hold this tile
      type="button"
      role="radio"
      aria-checked={current}
      aria-disabled={!live || undefined}
      data-testid={IDS.statusTile(tile.status)}
      data-step={tile.step}
      onClick={() => {
        if (!live) return;
        if (blocked) onNeedsPatient();
        else onPick(tile.status);
      }}
      className={cn(
        'text-detail relative flex h-10 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-start transition-[background-color,border-color] duration-150',
        TILE_LOOK[tile.step](tone),
        blocked && !current && 'text-disabled',
        !live && (cancelled ? 'cursor-default opacity-45' : 'cursor-default opacity-50'),
      )}
    >
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'text-tiny flex size-5 flex-none items-center justify-center rounded-full font-semibold',
          MARK_LOOK[tile.step](tone),
        )}
      >
        {done ? <Check className="size-3" /> : index + 1}
      </span>
      <span className="min-w-0 truncate">{t(APPT.statuses[tile.status])}</span>
    </button>
  );
  if (!hint) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/** The status hint line under the tiles (`formStatusHint`). */
function useStatusHint(
  saved: AppointmentStatus,
  draft: AppointmentStatus,
  isPatient: boolean,
) {
  const { t } = useTranslation(CLINIC_NS);
  const hint = formStatusHint({ saved, draft, isPatient });
  if (hint === 'closed') {
    return t(APPT.hints.closed, { status: t(APPT.statuses.no_show) });
  }
  return t(APPT.hints[hint]);
}

/** The cancelled banner (H:4141): the reason, the slot released, and Restore while it may. */
function CancelledBanner({
  reason,
  onRestore,
  restoring,
}: {
  reason: string | null;
  onRestore?: () => void;
  restoring: boolean;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  return (
    <div
      data-testid={IDS.cancelled}
      className="border-destructive-border bg-destructive-tint flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.3]">
        <span className="text-detail text-destructive font-semibold">
          {t(APPT.statuses.cancelled, { ns: CLINIC_NS })}
        </span>
        <span className="text-muted-foreground-strong text-xs">
          {reason ? t(K.cancelledReason, { reason }) : t(K.cancelledNoReason)}
        </span>
      </span>
      {onRestore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={restoring}
          data-testid={IDS.restore}
          onClick={onRestore}
          className="bg-card hover:bg-muted text-detail shadow-none"
        >
          {t(K.restore)}
        </Button>
      ) : null}
    </div>
  );
}

/** One 30px action of the row (Copy / Rebook, Cancel visit) with its tooltip. */
function VisitAction({
  label,
  hint,
  icon: Icon,
  destructive = false,
  onClick,
  testId,
}: {
  label: string;
  hint: string;
  icon: typeof Copy;
  destructive?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={destructive ? 'danger' : 'outline'}
          size="xs"
          data-testid={testId}
          onClick={onClick}
          className={cn(
            'text-detail h-7.5 gap-1.5',
            !destructive && 'bg-card hover:border-foreground hover:bg-muted shadow-none',
          )}
        >
          <Icon aria-hidden="true" className="size-3.25" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Visit status (Edit; H:2756–2762, H:4135–4150; `appointments.md:92–95`):
 * four tiles Scheduled → Confirmed → Checked in → Completed under the status
 * machine's rules (`formTiles`; each tile one route on clinozy-be) — Completed
 * after check-in and final once saved — the cancelled banner with Restore, the
 * Rescheduled note, Copy (Rebook for a No-show) and Cancel visit, and the hint
 * line. The plan flag went with the backend (no plan on a booking, G3).
 */
export function VisitStatusSection({
  saved,
  draft,
  date,
  today,
  isPatient,
  canEdit,
  onPick,
  onNeedsPatient,
  cancelReason,
  onRestore,
  restoring,
  rescheduled,
  onCopy,
  onCancelVisit,
}: VisitStatusSectionProps) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const tiles = formTiles({ saved, draft, date, today, isPatient, canEdit });
  const cancelled = saved === 'cancelled';
  const inert = cancelled || saved === 'no_show' || !canEdit;
  const hintText = useStatusHint(saved, draft, isPatient);
  const rebook = saved === 'no_show';
  return (
    <section
      aria-label={t(K.section)}
      data-testid={IDS.status}
      data-slot="visit-status"
      className="bg-card flex flex-none flex-col gap-2.5 rounded-xl border px-3.5 py-3"
    >
      <div role="radiogroup" aria-label={t(K.group)} className="grid grid-cols-4 gap-1.5">
        {tiles.map((tile, index) => (
          <StatusTile
            key={tile.status}
            tile={tile}
            index={index}
            inert={inert}
            cancelled={cancelled}
            onPick={onPick}
            onNeedsPatient={onNeedsPatient}
          />
        ))}
      </div>
      {cancelled ? (
        <CancelledBanner
          reason={cancelReason}
          onRestore={onRestore}
          restoring={restoring}
        />
      ) : null}
      {rescheduled ? (
        <div
          data-testid={IDS.rescheduled}
          className="border-tone-butter-border bg-tone-butter-tint text-tone-butter-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
        >
          <Calendar aria-hidden="true" className="size-3.25 flex-none" />
          <span className="min-w-0 text-pretty">{rescheduled}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCopy ? (
          <VisitAction
            label={rebook ? t(APPT.nextActions.rebook, { ns: CLINIC_NS }) : t(K.copy)}
            hint={t(K.copyHint)}
            icon={Copy}
            onClick={onCopy}
            testId={rebook ? IDS.rebook : IDS.copy}
          />
        ) : null}
        {onCancelVisit ? (
          <VisitAction
            label={t(K.cancelVisit)}
            hint={t(K.cancelHint)}
            icon={XCircle}
            destructive
            onClick={onCancelVisit}
            testId={IDS.cancelVisit}
          />
        ) : null}
      </div>
      <span
        data-testid={IDS.statusHint}
        className="text-muted-foreground text-xs text-pretty"
      >
        {hintText}
      </span>
    </section>
  );
}
