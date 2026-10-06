import {
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { focusSurfaceOnOpen } from '@/lib/focus-surface.ts';
import { cn } from '@/lib/utils.ts';
import {
  type AppointmentGuard,
  type AppointmentMove,
  appointmentMoveOptions,
  CANCEL_REASON_GROUPS,
  isFinalAppointmentStatus,
} from '@/shared/api/clinic/appointment-status.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import type { CancelReason } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { APPOINTMENT_STATUS_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';
import { ChevronLeft } from '@/shared/icons/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { useAppointmentActions } from '../AppointmentActions/index.ts';

/** What a popover anchor measures — the element `anchorRef` points at. */
type Measurable = { getBoundingClientRect: () => DOMRect };

/** Which list the popover shows: the moves, or "Why is it cancelled?". */
export type AppointmentStatusView = 'moves' | 'cancel';

/** Props for {@link AppointmentStatusPopover}. */
export interface AppointmentStatusPopoverProps {
  appointment: AppointmentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The list shown — the owner starts each opening on `moves` (or `cancel`, from the card). */
  view: AppointmentStatusView;
  onViewChange: (view: AppointmentStatusView) => void;
  /**
   * What it opens from: the Status button (`children`, its trigger) — or,
   * for a calendar block, the element `anchorRef` points at, which it only
   * sits under: the card's "Cancel" opens it there.
   */
  children?: ReactElement;
  anchorRef?: RefObject<HTMLElement | null>;
}

/** A move's dot: the status it moves to, stone for "Move to another time" and Cancel (H:5974). */
function moveDot(move: AppointmentMove): string {
  if (move === 'reschedule' || move === 'cancelled') return TONE_CLASSES.stone.dot;
  return TONE_CLASSES[APPOINTMENT_STATUS_TONES[move]].dot;
}

/** A move's label: the status's, "Move to another time", "Cancel". */
function moveLabelKey(move: AppointmentMove): string {
  if (move === 'reschedule') return CLINIC_KEYS.appointments.moves.reschedule;
  if (move === 'cancelled') return CLINIC_KEYS.appointments.moves.cancelled;
  return CLINIC_KEYS.appointments.statuses[move];
}

/** One option row: 8px dot, the label at 500 and its line — the reason, or why it is off. */
function MoveOption({
  move,
  guard,
  why,
  onPick,
}: {
  move: AppointmentMove;
  guard: AppointmentGuard;
  why: string;
  onPick: () => void;
}) {
  const { t } = useTranslation(CLINIC_NS);
  const off = !guard.allowed;
  return (
    <button
      type="button"
      title={why}
      aria-disabled={off || undefined}
      data-testid={APPOINTMENTS_TEST_IDS.statusOption(move)}
      onClick={() => {
        if (!off) onPick();
      }}
      className={cn(
        'text-body flex items-center gap-2 rounded-lg p-2 text-start transition-colors duration-120',
        off ? 'cursor-not-allowed opacity-45' : 'hover:bg-muted',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-2 flex-none rounded-full', moveDot(move))}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{t(moveLabelKey(move))}</span>
        <span className="text-micro text-muted-foreground">{why}</span>
      </span>
    </button>
  );
}

/** The note's length cap — the reason confirm's 160 (the schema allows 280, `S:134`). */
const NOTE_MAX_LENGTH = 160;

/**
 * "Why is it cancelled?" (`appointments.md:179`; H:3421): Back, then the
 * contract's reasons under PATIENT and CLINIC — one tap cancels. "Other"
 * opens its note right here, since the contract requires one (`S:1154`), and
 * the red "Cancel" waits for it beside the hint: asked once, never a second
 * confirm after the pick (L-64).
 */
function CancelView({
  backRef,
  onBack,
  onCancel,
}: {
  backRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onCancel: (reason: CancelReason, note: string | null) => void;
}) {
  const { t } = useTranslation([APPOINTMENTS_NS, CLINIC_NS]);
  const [note, setNote] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const formId = useId();
  const hintId = useId();
  const noting = note !== null;
  const ready = noting && note.trim() !== '';

  // Picking "Other" takes the user straight to its note.
  useEffect(() => {
    if (noting) noteRef.current?.focus();
  }, [noting]);

  const submit = () => {
    if (ready) onCancel('other', note.trim());
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 px-1 pt-0.5 pb-1">
        <Button
          ref={backRef}
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t(APPOINTMENTS_KEYS.status.back)}
          title={t(APPOINTMENTS_KEYS.status.back)}
          data-testid={APPOINTMENTS_TEST_IDS.statusBack}
          onClick={onBack}
          className="text-muted-foreground-strong hover:bg-muted size-6 rounded-md"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5 rtl:rotate-180" />
        </Button>
        <span className="text-body font-semibold">{t(APPOINTMENTS_KEYS.status.why)}</span>
      </div>
      {CANCEL_REASON_GROUPS.map(({ side, reasons }) => (
        <div
          key={side}
          role="group"
          aria-label={t(CLINIC_KEYS.appointments.cancelSides[side], { ns: CLINIC_NS })}
          className="flex flex-col gap-0.5"
        >
          <span
            aria-hidden="true"
            className="text-micro text-muted-foreground px-2 pt-1.5 pb-0.5 font-semibold tracking-[0.05em] uppercase"
          >
            {t(CLINIC_KEYS.appointments.cancelSides[side], { ns: CLINIC_NS })}
          </span>
          {reasons.map((reason) => {
            const other = reason === 'other';
            return (
              <button
                key={reason}
                type="button"
                aria-expanded={other ? noting : undefined}
                aria-controls={other && noting ? formId : undefined}
                data-testid={APPOINTMENTS_TEST_IDS.cancelReason(reason)}
                onClick={() => {
                  if (other) setNote((current) => current ?? '');
                  else onCancel(reason, null);
                }}
                className={cn(
                  'text-body hover:bg-muted flex min-h-8 items-center rounded-md px-2 text-start transition-colors',
                  other && noting && 'bg-muted font-medium',
                )}
              >
                {t(CLINIC_KEYS.appointments.cancelReasons[reason], { ns: CLINIC_NS })}
              </button>
            );
          })}
        </div>
      ))}
      {noting ? (
        <form
          id={formId}
          className="flex flex-col gap-1.5 px-1 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Textarea
            ref={noteRef}
            rows={2}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== 'Enter' ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              )
                return;
              event.preventDefault();
              submit();
            }}
            aria-label={t(REASON_CONFIRM_KEYS.note, { ns: CLINIC_NS })}
            aria-required
            placeholder={t(REASON_CONFIRM_KEYS.noteRequired, { ns: CLINIC_NS })}
            data-testid={APPOINTMENTS_TEST_IDS.cancelNote}
            className="md:text-body field-sizing-fixed min-h-0 resize-none rounded-lg px-2.5 py-2"
          />
          <div className="flex items-center gap-2">
            <span
              id={hintId}
              aria-live="polite"
              className="text-muted-foreground min-w-0 flex-1 text-xs"
            >
              {ready ? '' : t(REASON_CONFIRM_KEYS.hintAddNote, { ns: CLINIC_NS })}
            </span>
            <Button
              type="submit"
              variant={ready ? 'destructive' : 'ghost'}
              aria-disabled={ready ? undefined : true}
              aria-describedby={ready ? undefined : hintId}
              data-testid={APPOINTMENTS_TEST_IDS.cancelSubmit}
              className={cn(
                'text-body h-8 px-3',
                !ready &&
                  'bg-muted text-disabled hover:bg-muted hover:text-disabled cursor-not-allowed',
              )}
            >
              {t(CLINIC_KEYS.appointments.cancelConfirm.action, { ns: CLINIC_NS })}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * The Change status popover (`appointments.md:165–179`; H:2112–2119,
 * H:5974): "Now: <status>" (and the reason when cancelled), then each move out
 * of the status from the one transition table — a disabled one at 45% saying
 * why ("Only on <day>", "Available after <time> on <day>") — or "Final
 * status. Use Rebook to make a new appointment." Cancel opens "Why is it
 * cancelled?" ({@link CancelView}): one tap on a reason cancels, "Other"
 * takes its note there (L-64). 260px under the button, its inline-end edge on
 * the button's, above when the space below runs out; the same popover on a
 * phone.
 */
export function AppointmentStatusPopover({
  appointment,
  open,
  onOpenChange,
  view,
  onViewChange,
  children,
  anchorRef,
}: AppointmentStatusPopoverProps) {
  const { t } = useTranslation([APPOINTMENTS_NS, CLINIC_NS]);
  const actions = useAppointmentActions();
  const slotLabel = useAppointmentSlotLabel();
  const status = appointment.status;
  const options = open
    ? appointmentMoveOptions(
        {
          status,
          date: appointment.date,
          startTime: appointment.startTime,
          isPatient: appointment.person.kind === 'patient',
        },
        actions.guardOptions(),
      )
    : [];
  const slot = slotLabel(appointment.date, appointment.startTime);
  const close = () => onOpenChange(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // The cancel view starts on its Back button: keyboard users land in it, and
  // focus never falls out of the popover with the option that opened it.
  useEffect(() => {
    if (open && view === 'cancel') backRef.current?.focus();
  }, [open, view]);

  /** Swap the list, holding focus on the popover while the pressed option leaves. */
  const showView = (next: AppointmentStatusView) => {
    contentRef.current?.focus();
    onViewChange(next);
  };

  const whyFor = (move: AppointmentMove, guard: AppointmentGuard): string => {
    const keys = CLINIC_KEYS.appointments;
    if (guard.allowed) {
      return t(keys.moveHints[move], { ns: CLINIC_NS });
    }
    if (guard.reason === 'visit_day') {
      return t(keys.guards.visitDay, { ns: CLINIC_NS, day: slot.day });
    }
    if (guard.reason === 'before_start') {
      return t(keys.guards.beforeStart, { ns: CLINIC_NS, ...slot });
    }
    if (guard.reason === 'needs_patient') {
      return t(keys.guards.needsPatient, { ns: CLINIC_NS });
    }
    return t(keys.guards.final, { ns: CLINIC_NS });
  };

  const pick = (move: AppointmentMove) => {
    if (move === 'cancelled') {
      showView('cancel');
      return;
    }
    close();
    actions.move(appointment, move);
  };

  const statusLabel = t(CLINIC_KEYS.appointments.statuses[status], { ns: CLINIC_NS });
  const reasonLabel =
    status === 'cancelled' && appointment.cancelReason
      ? t(CLINIC_KEYS.appointments.cancelReasons[appointment.cancelReason], {
          ns: CLINIC_NS,
        })
      : null;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchorRef ? (
        <PopoverAnchor virtualRef={anchorRef as RefObject<Measurable>} />
      ) : (
        <PopoverTrigger asChild>{children}</PopoverTrigger>
      )}
      <PopoverContent
        role="dialog"
        aria-label={t(APPOINTMENTS_KEYS.status.title)}
        side="bottom"
        align="end"
        sideOffset={6}
        collisionPadding={8}
        ref={contentRef}
        data-testid={APPOINTMENTS_TEST_IDS.statusPopover}
        tabIndex={-1}
        onOpenAutoFocus={focusSurfaceOnOpen}
        className="data-[state=open]:data-[side=bottom]:animate-dropdown-in data-[state=open]:data-[side=top]:animate-dropdown-up flex w-65 max-w-[calc(100vw-1rem)] flex-col gap-0.5 rounded-lg p-2 data-[state=closed]:data-[side]:animate-none"
      >
        <span className="text-caption text-muted-foreground px-2 py-1">
          <Trans
            t={t}
            i18nKey={
              reasonLabel
                ? APPOINTMENTS_KEYS.status.nowReason
                : APPOINTMENTS_KEYS.status.now
            }
            values={{ status: statusLabel, reason: reasonLabel }}
            components={{ b: <span className="text-foreground font-semibold" /> }}
          />
        </span>
        {view === 'cancel' ? (
          <CancelView
            backRef={backRef}
            onBack={() => showView('moves')}
            onCancel={(reason, note) => {
              close();
              actions.cancel(appointment, reason, note);
            }}
          />
        ) : null}
        {view === 'moves' && options.length > 0
          ? options.map(({ move, guard }) => (
              <MoveOption
                key={move}
                move={move}
                guard={guard}
                why={whyFor(move, guard)}
                onPick={() => pick(move)}
              />
            ))
          : null}
        {view === 'moves' && isFinalAppointmentStatus(status) ? (
          <span className="text-muted-foreground p-2 text-xs">
            {t(CLINIC_KEYS.appointments.guards.final, { ns: CLINIC_NS })}
          </span>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
