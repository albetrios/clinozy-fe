import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog.tsx';
import { Button } from '@/shared/components/ui/button.tsx';

import {
  CONFIRM_KEYS,
  CONFIRM_NS,
  CONFIRM_TEST_IDS,
} from './confirm-dialog.constants.ts';
import { ReasonConfirm, type ReasonConfirmProps } from './ReasonConfirm.tsx';

/** The centred confirm every platform surface uses — `ConfirmDialog` without `reason`. */
export interface PlainConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** The action's label; "Confirm" by default. */
  confirmLabel?: string;
  /** The dismiss button's label; "Cancel" by default. */
  cancelLabel?: string;
  /** Style the confirm button as a destructive (red) action. */
  destructive?: boolean;
  /** Absent here: setting it switches to the reason panel. */
  reason?: undefined;
  /** Runs on confirm. If it resolves the dialog closes; if it throws it stays
   * open (the caller surfaces the error, e.g. via `notify`). */
  onConfirm: () => void | Promise<void>;
}

/**
 * Props of {@link ConfirmDialog}: the centred default, or — with `reason` —
 * the reason panel (from `md`) / bottom sheet (below) whose `onConfirm`
 * receives the picked reason and note.
 */
export type ConfirmDialogProps = PlainConfirmDialogProps | ReasonConfirmProps;

/**
 * The centred alert dialog: title, optional description, Cancel and the action.
 * On close it hands focus back to whatever was focused when it opened.
 */
function PlainConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: PlainConfirmDialogProps) {
  const { t } = useTranslation(CONFIRM_NS);
  const [busy, setBusy] = useState(false);
  // `busy` lands a render late; the ref drops a second click inside that frame.
  const busyRef = useRef(false);
  // Opened from state, not a Radix trigger, so Radix has nothing to give focus
  // back to and it fell to <body>: remember what was focused and return there.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Keep the dialog open — the caller is responsible for surfacing the error.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Don't allow dismissal mid-flight.
        if (!busyRef.current) onOpenChange(next);
      }}
    >
      <AlertDialogContent
        data-testid={CONFIRM_TEST_IDS.dialog}
        onOpenAutoFocus={() => {
          const previous = document.activeElement;
          returnFocusRef.current = previous instanceof HTMLElement ? previous : null;
        }}
        onCloseAutoFocus={(event) => {
          // A confirm that removed its opener (a deleted row) leaves focus to Radix.
          const target = returnFocusRef.current;
          if (!target?.isConnected) return;
          event.preventDefault();
          target.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">
              {t(CONFIRM_KEYS.fallbackDescription)}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} data-testid={CONFIRM_TEST_IDS.cancel}>
            {cancelLabel ?? t(CONFIRM_KEYS.cancel)}
          </AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={busy}
            isLoading={busy}
            data-testid={CONFIRM_TEST_IDS.accept}
          >
            {confirmLabel ?? t(CONFIRM_KEYS.accept)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Shared confirmation for destructive / irreversible actions. By default a
 * centred alert dialog (remove a member, delete a role or API key, delete an
 * organization); with `reason` the clinic rooms' reason confirm — a panel at
 * the inline end from `md`, a bottom sheet below, the schema's `delete_reason`
 * chips, a note, and Undo for 10s after the write (KICKOFF §3.5). Either way it
 * holds its busy state across the async confirm and blocks dismissal while in
 * flight.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  if (props.reason) return <ReasonConfirm {...props} />;
  return <PlainConfirmDialog {...props} />;
}
