import { type ReactElement, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { focusSurfaceOnOpen } from '@/lib/focus-surface.ts';
import { cn } from '@/lib/utils.ts';
import {
  allowedNext,
  APPOINTMENT_TILE_STATUSES,
  type AppointmentGuard,
  type AppointmentMove,
  NEXT_ACTION_MOVES,
  nextAction,
  transitionGuard,
} from '@/shared/api/clinic/appointment-status.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { serviceTone } from '@/shared/clinic/appointment-display.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { APPOINTMENT_STATUS_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  personFullName,
  personInitials,
  shortPersonName,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/shared/components/ui/hover-card.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';
import { Check } from '@/shared/icons/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { latestEvent, PERSON_TONES } from '../../appointments.display.ts';
import { useLatestUpdateWords } from '../../hooks/useLatestUpdateWords/index.ts';
import { useAppointmentActions } from '../AppointmentActions/index.ts';
import { AppointmentStatusPill } from '../AppointmentStatusPill/index.ts';

/** The card's frame: 340px, padding 12px, the screen less 16px tall at most (H:2090). */
const CARD_FRAME =
  'flex w-85 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] flex-col gap-2.5 overflow-auto rounded-xl p-3 data-[state=closed]:animate-none data-[state=open]:data-[side=bottom]:animate-dropdown-in data-[state=open]:data-[side=top]:animate-dropdown-up';

/** The 9.5px tracker labels — `--text-xs` × 19/24, so the Type scale axis moves them. */
const TRACKER_TEXT = 'text-[length:calc(var(--text-xs)*19/24)]';

/** The four steps of the tracker, each in its status tone: done ✓ on the tint, current solid, upcoming grey (H:6117). */
function StatusTracker({ appointment }: { appointment: AppointmentRow }) {
  const { t } = useTranslation([APPOINTMENTS_NS, CLINIC_NS]);
  const closed = appointment.status === 'cancelled' || appointment.status === 'no_show';
  const position = closed
    ? -1
    : APPOINTMENT_TILE_STATUSES.indexOf(
        appointment.status as (typeof APPOINTMENT_TILE_STATUSES)[number],
      );
  return (
    <ol aria-label={t(APPOINTMENTS_KEYS.card.tracker)} className="flex items-center py-1">
      {APPOINTMENT_TILE_STATUSES.map((status, index) => {
        const tone = TONE_CLASSES[APPOINTMENT_STATUS_TONES[status]];
        const done = index < position;
        const current = index === position;
        const last = index === APPOINTMENT_TILE_STATUSES.length - 1;
        const label = t(CLINIC_KEYS.appointments.statuses[status], { ns: CLINIC_NS });
        let disc = 'bg-muted text-muted-foreground';
        if (current) disc = cn(tone.ink, 'bg-current');
        else if (done) disc = tone.surface;
        return (
          <li
            key={status}
            aria-current={current ? 'step' : undefined}
            className={cn('flex items-center', !last && 'flex-1')}
          >
            <span className="flex flex-none flex-col items-center gap-0.75" title={label}>
              <span
                aria-hidden="true"
                data-slot="pill"
                className={cn(
                  'flex size-5 items-center justify-center rounded-full font-semibold',
                  TRACKER_TEXT,
                  disc,
                )}
              >
                {done ? (
                  <Check className="size-2.5" />
                ) : (
                  <span className={cn(current && 'text-background')}>{index + 1}</span>
                )}
              </span>
              <span
                className={cn('text-muted-foreground whitespace-nowrap', TRACKER_TEXT)}
              >
                {label}
              </span>
            </span>
            {last ? null : (
              <span
                aria-hidden="true"
                className={cn(
                  'mx-1 mb-3.25 h-0.5 flex-1 rounded-xs',
                  done ? [tone.ink, 'bg-current'] : 'bg-muted-strong',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A move's label on the card: "Reschedule", "Cancel", else the status it moves to (H:6118). */
function cardMoveLabelKey(move: AppointmentMove): string {
  if (move === 'reschedule') return APPOINTMENTS_KEYS.card.reschedule;
  if (move === 'cancelled') return APPOINTMENTS_KEYS.card.cancel;
  return CLINIC_KEYS.appointments.statuses[move];
}

/** Props for {@link AppointmentCardContent}. */
export interface AppointmentCardContentProps {
  appointment: AppointmentRow;
  /** Close the card (after any action). */
  close: () => void;
  /** "Cancel": the Change status popover's cancel view, where the booking shows. */
  onCancel: (appointment: AppointmentRow) => void;
}

/**
 * The appointment card's content (`appointments.md:149–163`; H:2090–2095):
 * the person and "#<seq>", the service and status pills, "<day> · <time> ·
 * <n> min", the doctor, the last update, "This appointment is closed ·
 * <status>", the 4-step tracker; then the next step and "Open", and the other
 * moves — each through the popover's guards (Q-A7). The name and the doctor
 * read in their own direction, the phone and the id left to right, and the
 * day and time are isolated in their line — whole on a right-to-left page.
 */
export function AppointmentCardContent({
  appointment,
  close,
  onCancel,
}: AppointmentCardContentProps) {
  const { t } = useTranslation([APPOINTMENTS_NS, CLINIC_NS]);
  const actions = useAppointmentActions();
  const slotLabel = useAppointmentSlotLabel();
  const words = useLatestUpdateWords();
  const { person, doctor, status } = appointment;
  const slot = slotLabel(appointment.date, appointment.startTime);
  const today = clinicToday();
  const step = nextAction(appointment, today);
  const stepMove = step ? NEXT_ACTION_MOVES[step] : null;
  const subject = {
    status,
    date: appointment.date,
    startTime: appointment.startTime,
    isPatient: person.kind === 'patient',
  };
  const options = actions.guardOptions();
  const guardOf = (move: AppointmentMove): AppointmentGuard =>
    transitionGuard(subject, move, options);
  // Rebook makes a new booking: it needs Create, not a move (Q-A6).
  let stepGuard: AppointmentGuard = { allowed: true };
  if (stepMove !== null) stepGuard = guardOf(stepMove);
  else if (!actions.canCreate) stepGuard = { allowed: false, reason: 'no_access' };
  const moves = allowedNext(status).filter((move) => move !== stepMove);
  const closed = status === 'cancelled' || status === 'no_show';
  const event = latestEvent(appointment);
  const doctorName = doctor ? shortPersonName(personFullName(doctor)) : '';
  const run = (action: () => void) => () => {
    close();
    action();
  };

  const runMove = (move: AppointmentMove) => {
    if (move === 'cancelled') {
      onCancel(appointment);
      return;
    }
    actions.move(appointment, move);
  };

  return (
    <>
      <div className="flex items-center gap-2.5">
        <PersonAvatar
          size="header"
          initials={personInitials(person.name)}
          tone={PERSON_TONES[person.kind]}
          patient={person.kind === 'patient'}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            dir="auto"
            className="text-field truncate [text-align:match-parent] leading-[1.3] font-semibold"
          >
            {person.name}
          </span>
          {person.phone ? (
            <span
              dir="ltr"
              className="text-caption text-muted-foreground [text-align:match-parent] leading-[1.3] tabular-nums"
            >
              {formatClinicPhone(person.phone)}
            </span>
          ) : null}
        </span>
        <span
          dir="ltr"
          className="text-micro text-muted-foreground flex-none tabular-nums"
        >
          {displayId.appointment(appointment.seq)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TonePill tone={serviceTone(appointment)} className="tabular-nums">
          {appointment.serviceLabel}
        </TonePill>
        <AppointmentStatusPill status={status} />
      </div>
      <div className="text-detail text-foreground-soft flex flex-col gap-1">
        <span className="tabular-nums">
          {t(APPOINTMENTS_KEYS.card.when, {
            ...isolateValues(slot),
            minutes: appointment.durationMin,
          })}
        </span>
        {doctor ? (
          <span className="flex items-center gap-1.5">
            <PersonAvatar size="line" initials={doctor.initials} tone={doctor.tone} />
            <span dir="auto">{doctorName}</span>
          </span>
        ) : null}
        <span className="text-muted-foreground truncate">
          {event ? words.hint(event) : t(APPOINTMENTS_KEYS.card.noUpdate)}
        </span>
      </div>
      {closed ? (
        <span className="text-caption text-muted-foreground">
          {t(CLINIC_KEYS.appointments.hints.closed, {
            ns: CLINIC_NS,
            status: t(CLINIC_KEYS.appointments.statuses[status], { ns: CLINIC_NS }),
          })}
        </span>
      ) : null}
      <StatusTracker appointment={appointment} />
      <div className="flex gap-1.5 border-t pt-2">
        {step ? (
          <CardButton
            primary
            testId={APPOINTMENTS_TEST_IDS.cardNext}
            guard={stepGuard}
            onClick={run(() => actions.runNext(appointment))}
          >
            {t(CLINIC_KEYS.appointments.nextActions[step], { ns: CLINIC_NS })}
          </CardButton>
        ) : null}
        <CardButton
          testId={APPOINTMENTS_TEST_IDS.cardOpen}
          guard={{ allowed: true }}
          onClick={run(() => actions.open(appointment))}
        >
          {t(APPOINTMENTS_KEYS.card.open)}
        </CardButton>
      </div>
      {actions.canEdit && moves.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {moves.map((move) => (
            <CardButton
              key={move}
              small
              destructive={move === 'cancelled' || move === 'no_show'}
              testId={APPOINTMENTS_TEST_IDS.cardMove(move)}
              guard={guardOf(move)}
              onClick={run(() => runMove(move))}
            >
              {t(cardMoveLabelKey(move), {
                ns:
                  move === 'reschedule' || move === 'cancelled'
                    ? APPOINTMENTS_NS
                    : CLINIC_NS,
              })}
            </CardButton>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** A card action: the 32px primary, "Open", or a 32px move (destructive in red); off moves stay at 50% (H:2094). */
function CardButton({
  primary = false,
  small = false,
  destructive = false,
  guard,
  testId,
  onClick,
  children,
}: {
  primary?: boolean;
  small?: boolean;
  destructive?: boolean;
  guard: AppointmentGuard;
  testId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const off = !guard.allowed;
  // The outline move: neutral, or red ink on a red edge that tints on hover.
  const look = destructive
    ? 'text-destructive border-destructive-border hover:bg-destructive-tint hover:text-destructive'
    : 'text-foreground hover:bg-muted';
  return (
    <Button
      type="button"
      variant={primary ? 'default' : 'outline'}
      size="sm"
      aria-disabled={off || undefined}
      data-testid={testId}
      onClick={() => {
        if (!off) onClick();
      }}
      className={cn(
        'duration-120',
        small ? 'px-2.5 text-xs' : 'text-detail min-w-0 flex-1',
        !primary && cn('bg-card shadow-none', look),
        off && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </Button>
  );
}

/** Props for {@link AppointmentQuickView}. */
export interface AppointmentQuickViewProps {
  appointment: AppointmentRow;
  onCancel: (appointment: AppointmentRow) => void;
  /** The eye button. */
  children: ReactElement;
}

/**
 * The quick view (H:2044, H:6116): the eye pins the card at its inline start —
 * the card's end edge 8px before the eye — below it, or above when the space
 * below runs out; a tap outside or Esc closes it (the transparent backdrop).
 */
export function AppointmentQuickView({
  appointment,
  onCancel,
  children,
}: AppointmentQuickViewProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {/* Radix's popover content is a `role="dialog"` of its own. */}
      <PopoverContent
        aria-label={t(APPOINTMENTS_KEYS.record)}
        side="bottom"
        align="end"
        alignOffset={40}
        sideOffset={6}
        collisionPadding={8}
        data-testid={APPOINTMENTS_TEST_IDS.appointmentCard}
        tabIndex={-1}
        onOpenAutoFocus={focusSurfaceOnOpen}
        className={CARD_FRAME}
      >
        <AppointmentCardContent
          appointment={appointment}
          close={() => setOpen(false)}
          onCancel={onCancel}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Props for {@link AppointmentHoverCard}. */
export interface AppointmentHoverCardProps {
  appointment: AppointmentRow;
  onCancel: (appointment: AppointmentRow) => void;
  /** The calendar block. */
  children: ReactElement;
}

/**
 * The hover card on a calendar block (H:2090, H:5898): opens 420ms after the
 * pointer arrives and closes 160ms after it leaves; below the block when 300px
 * fit or below is roomier, else above. Never on touch — a tap opens the form.
 */
export function AppointmentHoverCard({
  appointment,
  onCancel,
  children,
}: AppointmentHoverCardProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const [open, setOpen] = useState(false);
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={420} closeDelay={160}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent // NOSONAR(S6819): Radix's portalled floating layer — a native <dialog> cannot be it
        role="dialog"
        aria-label={t(APPOINTMENTS_KEYS.record)}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        data-testid={APPOINTMENTS_TEST_IDS.appointmentCard}
        className={CARD_FRAME}
      >
        <AppointmentCardContent
          appointment={appointment}
          close={() => setOpen(false)}
          onCancel={onCancel}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
