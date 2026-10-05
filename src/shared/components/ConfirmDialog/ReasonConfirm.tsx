import {
  AlertDialog as AlertDialogPrimitive,
  RadioGroup as RadioGroupPrimitive,
} from 'radix-ui';
import {
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/shared/components/ui/drawer.tsx';
import { RadioGroup } from '@/shared/components/ui/radio-group.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { X } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { CONFIRM_TEST_IDS, confirmReasonTestId } from './confirm-dialog.constants.ts';
import {
  type ConfirmReasonChoice,
  type ConfirmReasonKind,
  type ConfirmReasonOption,
  needsNote,
  REASON_KINDS,
  reasonChipTone,
  toReasonChoice,
} from './confirm-reasons.ts';
import { runConfirmedWrite } from './confirmed-write.ts';
import { REASON_CONFIRM_KEYS, REASON_CONFIRM_NS } from './reason-confirm.constants.ts';

/** The note's length cap — the design's 160 (the schema allows 280, `S:134`). */
const NOTE_MAX_LENGTH = 160;

/** The reason variant's settings — `ConfirmDialog`'s `reason` prop. */
export interface ConfirmReasonConfig {
  /** Delete (default), Cancel (purchase orders) or Void (sales): the reasons, action label and effect line. */
  kind?: ConfirmReasonKind;
  /** The record as a grey pill under the title ("Rhea Shah · #2363") — the title never names it. */
  record?: string;
  /** Caller-supplied reasons (appointment cancel, photo delete, lead remove); the kind's otherwise. */
  options?: readonly ConfirmReasonOption[];
  /**
   * The reason picked as it opens — a value of `options` (the status
   * popover's "Other" opens it on "Other", waiting for the note; A-A3).
   */
  initial?: string;
  /**
   * Once the write lands: the toast's text ("Priya Shah removed") and the
   * restore its Undo runs, offered for the schema's 10s restore window (D32).
   * `onUndo` surfaces its own failure — a `useAppMutation` write already does.
   */
  undo?: {
    message: string | ((choice: ConfirmReasonChoice) => string);
    onUndo: () => unknown;
  };
}

/** `ConfirmDialog` with `reason` set: the reason panel from `md`, a bottom sheet below. */
export interface ReasonConfirmProps {
  open: boolean;
  /** `false` is "Keep it" — the ×, the button, the backdrop and Esc all send it; never mid-write. */
  onOpenChange: (open: boolean) => void;
  /** "<Action> this <record type>?" — "Delete this lead?", never the record's name. */
  title: string;
  /** The one-line effect; the kind's by default. */
  description?: ReactNode;
  /** The action's label; the kind's by default ("Delete", "Cancel order", "Void sale"). */
  confirmLabel?: string;
  /** The dismiss button's label; "Keep it" by default. */
  cancelLabel?: string;
  reason: ConfirmReasonConfig;
  /**
   * The write. Resolving closes the confirm (and offers Undo); throwing keeps it
   * open — a 422 on the reason or note shows at the field, anything else is the
   * caller's to surface.
   */
  onConfirm: (choice: ConfirmReasonChoice) => void | Promise<void>;
}

/** The confirm's own fields, as a 422 can name them. */
interface ReasonFieldErrors {
  reason?: string;
  note?: string;
}

/** Field names clinozy-be can return for the two values: the request's and the entity's. */
const FIELD_OF: Readonly<Record<string, keyof ReasonFieldErrors>> = {
  reason: 'reason',
  deleteReason: 'reason',
  note: 'note',
  deleteNote: 'note',
};

/** A 422's messages for the reason and the note; nothing for any other failure. */
function fieldErrorsOf(error: unknown): ReasonFieldErrors {
  const found: ReasonFieldErrors = {};
  const collect: UseFormSetError<{ reason: string; note: string }> = (
    name,
    { message },
  ) => {
    const field = FIELD_OF[name];
    if (field && message) found[field] ??= message;
  };
  mapValidationErrors(error, collect);
  return found;
}

/** Raise the "<name> removed" toast whose Undo restores — for the 10s restore window. */
function offerUndo(undo: ConfirmReasonConfig['undo'], choice: ConfirmReasonChoice) {
  if (!undo) return;
  const message =
    typeof undo.message === 'function' ? undo.message(choice) : undo.message;
  notify.undo(message, {
    onUndo: () => {
      // The restore reports its own failure (see `undo` above); this only keeps
      // a rejected promise from going unhandled.
      Promise.resolve()
        .then(undo.onUndo)
        .catch(() => undefined);
    },
  });
}

type Layout = 'panel' | 'sheet';

/** Element ids the fields, hint and errors reference each other by. */
interface ReasonIds {
  reasonLabel: string;
  reasonError: string;
  noteError: string;
  hint: string;
}

/**
 * The confirm's working state — the picked chip, the note, field errors and
 * the write in flight — kept above the panel / sheet switch, so a resize
 * across `md` mid-confirm keeps what was picked.
 */
function useReasonDraft({
  open,
  onOpenChange,
  reason,
  onConfirm,
}: Pick<ReasonConfirmProps, 'open' | 'onOpenChange' | 'reason' | 'onConfirm'>) {
  const { t } = useTranslation(REASON_CONFIRM_NS);
  const [picked, setPicked] = useState(reason.initial ?? '');
  const [typed, setTyped] = useState('');
  const [errors, setErrors] = useState<ReasonFieldErrors>({});
  const [busy, setBusy] = useState(false);
  // The visible `busy` lands a render late; this ref is the single-flight guard.
  const busyRef = useRef(false);

  // Every opening starts clean — the last record's reason and note never carry over.
  const [openedAs, setOpenedAs] = useState(open);
  if (open !== openedAs) {
    setOpenedAs(open);
    if (open) {
      setPicked(reason.initial ?? '');
      setTyped('');
      setErrors({});
    }
  }

  const kind = REASON_KINDS[reason.kind ?? 'delete'];
  const options = reason.options ?? kind.options;
  const option = options.find((candidate) => candidate.value === picked);
  const missingNote =
    option !== undefined && needsNote(option.value) && typed.trim() === '';
  let hint = '';
  if (option === undefined) hint = t(REASON_CONFIRM_KEYS.hintPickReason);
  else if (missingNote) hint = t(REASON_CONFIRM_KEYS.hintAddNote);

  const changeOpen = (next: boolean) => {
    if (!busyRef.current) onOpenChange(next);
  };

  const confirm = async () => {
    if (!option || missingNote || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrors({});
    const choice = toReasonChoice(
      { value: option.value, label: t(option.labelKey) },
      typed,
    );
    const landed = await Promise.resolve()
      .then(() => runConfirmedWrite(() => onConfirm(choice)))
      .then(
        () => true,
        (error: unknown) => {
          setErrors(fieldErrorsOf(error));
          return false;
        },
      );
    busyRef.current = false;
    setBusy(false);
    if (!landed) return;
    onOpenChange(false);
    offerUndo(reason.undo, choice);
  };

  return {
    kind,
    options,
    picked,
    typed,
    errors,
    busy,
    hint,
    ready: option !== undefined && !missingNote,
    changeOpen,
    keep: () => changeOpen(false),
    pick: (value: string) => {
      setPicked(value);
      setErrors((current) => ({ ...current, reason: undefined }));
    },
    type: (value: string) => {
      setTyped(value);
      setErrors((current) => ({ ...current, note: undefined }));
    },
    confirm: () => void confirm(),
  };
}

type ReasonDraft = ReturnType<typeof useReasonDraft>;

type TextSlot = ComponentType<ComponentProps<typeof AlertDialogTitle>>;

/** What the panel and the sheet both render. */
interface ReasonViewProps {
  open: boolean;
  draft: ReasonDraft;
  ids: ReasonIds;
  title: string;
  record?: string;
  effect: ReactNode;
  keepLabel: string;
  actionLabel: string;
}

/** Title, record pill and effect line — the same in the panel and the sheet. */
function ReasonHeader({
  layout,
  title,
  record,
  effect,
  Title,
  Description,
}: {
  layout: Layout;
  title: string;
  record?: string;
  effect: ReactNode;
  Title: TextSlot;
  Description: TextSlot;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 border-b pt-5 pb-3',
        layout === 'panel'
          ? 'min-h-(--drawer-header-height) justify-center px-(--drawer-pad-x)'
          : 'ps-(--drawer-pad-x) pe-14',
      )}
    >
      <Title className="text-base leading-snug font-semibold text-pretty">{title}</Title>
      {/* The record and the effect line together are the description, so a
          screen reader hears which record before what will happen to it. */}
      <Description asChild>
        <div className="flex flex-col gap-1.5">
          {record ? (
            <span
              data-slot="pill"
              data-testid={CONFIRM_TEST_IDS.record}
              className="bg-muted text-foreground text-detail inline-flex h-6 max-w-full items-center self-start rounded-full px-2.5 font-medium"
            >
              <span className="truncate">{record}</span>
            </span>
          ) : null}
          <span className="text-body text-muted-foreground-strong text-pretty">
            {effect}
          </span>
        </div>
      </Description>
    </div>
  );
}

const CHIP_CLASS =
  'text-detail inline-flex h-7 items-center px-3 font-medium whitespace-nowrap transition-shadow hover:ring-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:ring-[1.5px]';

/** A field's message from the server (a 422), announced as it appears. */
function FieldError({
  id,
  testId,
  message,
}: {
  id: string;
  testId: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      data-testid={testId}
      className="text-caption text-destructive"
    >
      {message}
    </p>
  );
}

/** "Reason" chips (a radio group) and the note. */
function ReasonFields({ draft, ids }: { draft: ReasonDraft; ids: ReasonIds }) {
  const { t } = useTranslation(REASON_CONFIRM_NS);
  const { errors } = draft;
  const noteRequired = draft.picked !== '' && needsNote(draft.picked);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // The server turned the note down: take the user straight to it.
  useEffect(() => {
    if (errors.note) noteRef.current?.focus();
  }, [errors.note]);

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-(--table-pad-x) pt-1 pb-4">
      <span
        id={ids.reasonLabel}
        className="text-micro text-muted-foreground font-semibold tracking-wider uppercase"
      >
        {t(REASON_CONFIRM_KEYS.reason)}
      </span>
      <RadioGroup
        value={draft.picked}
        onValueChange={draft.pick}
        disabled={draft.busy}
        aria-labelledby={ids.reasonLabel}
        aria-describedby={errors.reason ? ids.reasonError : undefined}
        className="flex flex-wrap gap-1.5"
      >
        {draft.options.map((option, index) => (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            data-slot="pill"
            data-testid={confirmReasonTestId(option.value)}
            className={cn(CHIP_CLASS, 'rounded-full', reasonChipTone(index))}
          >
            {t(option.labelKey)}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroup>
      <FieldError
        id={ids.reasonError}
        testId={CONFIRM_TEST_IDS.reasonError}
        message={errors.reason}
      />
      <Textarea
        ref={noteRef}
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        value={draft.typed}
        onChange={(event) => draft.type(event.target.value)}
        readOnly={draft.busy}
        aria-label={t(REASON_CONFIRM_KEYS.note)}
        aria-required={noteRequired || undefined}
        aria-invalid={errors.note ? true : undefined}
        aria-describedby={errors.note ? ids.noteError : undefined}
        placeholder={t(
          noteRequired
            ? REASON_CONFIRM_KEYS.noteRequired
            : REASON_CONFIRM_KEYS.notePlaceholder,
        )}
        data-testid={CONFIRM_TEST_IDS.note}
        // A drag that starts in the note selects text; it never pulls the sheet.
        data-vaul-no-drag=""
        className="md:text-body field-sizing-fixed min-h-0 resize-y rounded-lg px-2.5 py-2"
      />
      <FieldError
        id={ids.noteError}
        testId={CONFIRM_TEST_IDS.noteError}
        message={errors.note}
      />
    </div>
  );
}

/** The action: the destructive fill once a reason (and any required note) is in, else muted and `aria-disabled`. */
function ReasonAction({
  layout,
  draft,
  ids,
  label,
}: {
  layout: Layout;
  draft: ReasonDraft;
  ids: ReasonIds;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={draft.ready ? 'destructive' : 'ghost'}
      aria-disabled={draft.ready ? undefined : true}
      aria-describedby={draft.hint ? ids.hint : undefined}
      isLoading={draft.busy}
      onClick={draft.confirm}
      data-testid={CONFIRM_TEST_IDS.accept}
      className={cn(
        'text-body',
        layout === 'panel' ? 'h-9 px-4' : 'h-11 flex-1 px-3',
        !draft.ready &&
          'bg-muted text-disabled hover:bg-muted hover:text-disabled cursor-not-allowed',
      )}
    >
      {label}
    </Button>
  );
}

/** The hint at the footer's start, then "Keep it" and the action; on a phone the hint takes its own row. */
function ReasonFooter({
  layout,
  hint,
  hintId,
  keep,
  action,
}: {
  layout: Layout;
  hint: string;
  hintId: string;
  keep: ReactNode;
  action: ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-canvas mt-auto flex shrink-0 items-center gap-2 border-t',
        layout === 'panel'
          ? 'px-(--table-pad-x) py-3'
          : 'flex-wrap p-(--drawer-footer-pad)',
      )}
    >
      <span
        id={hintId}
        aria-live="polite"
        data-testid={CONFIRM_TEST_IDS.hint}
        className={cn(
          'text-muted-foreground min-w-0 text-xs',
          layout === 'panel'
            ? 'flex-1'
            : 'order-last basis-full text-center empty:hidden',
        )}
      >
        {hint}
      </span>
      {keep}
      {action}
    </div>
  );
}

/** Below `md`: a bottom sheet — full width, × inside, 44px footer buttons over the safe area. */
function ReasonSheet({
  open,
  draft,
  ids,
  title,
  record,
  effect,
  keepLabel,
  actionLabel,
}: ReasonViewProps) {
  const { t: tShared } = useTranslation(LOCALE_NS);
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <Drawer open={open} onOpenChange={draft.changeOpen} dismissible={!draft.busy}>
      <DrawerContent
        role="alertdialog"
        showHandle={false}
        overlayClassName="bg-overlay/32"
        data-layout="sheet"
        data-testid={CONFIRM_TEST_IDS.dialog}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepRef.current?.focus();
        }}
        className="data-[vaul-drawer-direction=bottom]:max-h-[85vh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl"
      >
        <ReasonHeader
          layout="sheet"
          title={title}
          record={record}
          effect={effect}
          Title={DrawerTitle}
          Description={DrawerDescription}
        />
        <ReasonFields draft={draft} ids={ids} />
        <ReasonFooter
          layout="sheet"
          hint={draft.hint}
          hintId={ids.hint}
          keep={
            <Button
              ref={keepRef}
              type="button"
              variant="outline"
              disabled={draft.busy}
              onClick={draft.keep}
              data-testid={CONFIRM_TEST_IDS.cancel}
              className="text-body h-11 flex-1 px-3"
            >
              {keepLabel}
            </Button>
          }
          action={
            <ReasonAction layout="sheet" draft={draft} ids={ids} label={actionLabel} />
          }
        />
        <button
          type="button"
          onClick={draft.keep}
          disabled={draft.busy}
          aria-label={tShared(LOCALE_KEYS.closeAria)}
          data-testid={CONFIRM_TEST_IDS.close}
          className="text-foreground-soft hover:bg-muted absolute end-2 top-2 flex size-11 items-center justify-center rounded-lg"
        >
          <X className="size-5.5" aria-hidden />
        </button>
      </DrawerContent>
    </Drawer>
  );
}

/** From `md`: a full-height panel at the inline end, its × floating outside the start edge. */
function ReasonPanel({
  open,
  draft,
  ids,
  title,
  record,
  effect,
  keepLabel,
  actionLabel,
}: ReasonViewProps) {
  const { t: tShared } = useTranslation(LOCALE_NS);
  return (
    <AlertDialog open={open} onOpenChange={draft.changeOpen}>
      <AlertDialogPrimitive.Portal>
        {/* The backdrop is "Keep it" too: an alert dialog ignores outside
            presses, so the overlay answers its own click. */}
        <AlertDialogPrimitive.Overlay
          data-slot="alert-dialog-overlay"
          onClick={draft.keep}
          className="bg-overlay/32 animate-backdrop-in fixed inset-0 z-50"
        />
        <AlertDialogPrimitive.Content
          data-slot="alert-dialog-content"
          data-layout="panel"
          data-testid={CONFIRM_TEST_IDS.dialog}
          className="bg-background text-foreground animate-drawer-in fixed inset-y-0 end-0 z-50 flex w-[min(30rem,calc(100vw-3.5rem))] flex-col border-s outline-none"
        >
          <ReasonHeader
            layout="panel"
            title={title}
            record={record}
            effect={effect}
            Title={AlertDialogTitle}
            Description={AlertDialogDescription}
          />
          <ReasonFields draft={draft} ids={ids} />
          <ReasonFooter
            layout="panel"
            hint={draft.hint}
            hintId={ids.hint}
            keep={
              // The alert dialog's Cancel: it takes the initial focus.
              <AlertDialogCancel
                disabled={draft.busy}
                data-testid={CONFIRM_TEST_IDS.cancel}
                className="text-body h-9 px-3.5"
              >
                {keepLabel}
              </AlertDialogCancel>
            }
            action={
              <ReasonAction layout="panel" draft={draft} ids={ids} label={actionLabel} />
            }
          />
          {/* Floats outside the panel's inline-start edge; last in the DOM so
              Tab reaches the reasons and the footer first. */}
          <button
            type="button"
            onClick={draft.keep}
            disabled={draft.busy}
            aria-label={tShared(LOCALE_KEYS.closeAria)}
            data-slot="floating-edge"
            data-testid={CONFIRM_TEST_IDS.close}
            className="bg-background text-foreground-soft hover:bg-muted animate-pop-in absolute end-[calc(100%+0.625rem)] top-3.5 flex size-9 items-center justify-center rounded-lg border"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialog>
  );
}

/**
 * The reason confirm (KICKOFF §3.5, `_patterns.md` › Delete confirm): a
 * full-height panel at the inline end from `md`, a bottom sheet below. One
 * reason chip is required, "Other" also needs a note; the action stays
 * `aria-disabled` with the hint saying why. Esc, the backdrop, × and "Keep it"
 * all keep the record. A confirmed write closes it and, given `undo`, offers
 * Undo for 10s.
 */
export function ReasonConfirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  reason,
  onConfirm,
}: ReasonConfirmProps) {
  const { t } = useTranslation(REASON_CONFIRM_NS);
  const tier = useViewportTier();
  const baseId = useId();
  const draft = useReasonDraft({ open, onOpenChange, reason, onConfirm });
  const view: ReasonViewProps = {
    open,
    draft,
    ids: {
      reasonLabel: `${baseId}-reason`,
      reasonError: `${baseId}-reason-error`,
      noteError: `${baseId}-note-error`,
      hint: `${baseId}-hint`,
    },
    title,
    record: reason.record,
    effect: description ?? t(draft.kind.effectKey),
    keepLabel: cancelLabel ?? t(REASON_CONFIRM_KEYS.keep),
    actionLabel: confirmLabel ?? t(draft.kind.actionKey),
  };
  return tier === 'phone' ? <ReasonSheet {...view} /> : <ReasonPanel {...view} />;
}
