import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/components/ui/button.tsx';

import {
  CONFIRM_BUTTON_CLASS,
  CONFIRM_KEYS,
  CONFIRM_NS,
  CONFIRM_TEST_IDS,
} from './confirm-dialog.constants.ts';
import { ConfirmPanel } from './confirm-panel.tsx';
import { runConfirmedWrite } from './confirmed-write.ts';
import { ReasonConfirm, type ReasonConfirmProps } from './ReasonConfirm.tsx';

/** A plain confirm's own test ids, for a surface whose specs already name them. */
export type ConfirmTestIds = Partial<Record<'dialog' | 'cancel' | 'accept', string>>;

/** The confirm every platform surface uses — `ConfirmDialog` without `reason`. */
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
  /** The surface's own test ids; `confirm-dialog` / `-cancel` / `-accept` otherwise. */
  testIds?: ConfirmTestIds;
  /** Absent here: setting it switches to the reason confirm. */
  reason?: undefined;
  /** Runs on confirm. If it resolves the dialog closes; if it throws it stays
   * open (the caller surfaces the error, e.g. via `notify`). */
  onConfirm: () => void | Promise<void>;
}

/**
 * Props of {@link ConfirmDialog}: the plain confirm, or — with `reason` — the
 * reason confirm whose `onConfirm` receives the picked reason and note. Both
 * take the same frame: the end panel from `md`, the bottom sheet below.
 */
export type ConfirmDialogProps = PlainConfirmDialogProps | ReasonConfirmProps;

/**
 * The plain confirm in the confirm frame: title, optional description, Cancel
 * and the action. Cancel takes the initial focus; on close focus goes back to
 * whatever was focused when it opened.
 */
function PlainConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  testIds,
  onConfirm,
}: PlainConfirmDialogProps) {
  const { t } = useTranslation(CONFIRM_NS);
  const [busy, setBusy] = useState(false);
  // `busy` lands a render late; the ref drops a second click inside that frame.
  const busyRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Every exit — Cancel, ×, the backdrop, Esc — is held while the write runs.
  const dismiss = () => {
    if (!busyRef.current) onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await runConfirmedWrite(onConfirm);
      onOpenChange(false);
    } catch {
      // Keep the dialog open — the caller is responsible for surfacing the error.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <ConfirmPanel
      open={open}
      onDismiss={dismiss}
      busy={busy}
      title={title}
      description={
        description ? (
          <div className="text-body text-muted-foreground-strong text-pretty">
            {description}
          </div>
        ) : (
          <div className="sr-only">{t(CONFIRM_KEYS.fallbackDescription)}</div>
        )
      }
      initialFocusRef={cancelRef}
      testId={testIds?.dialog ?? CONFIRM_TEST_IDS.dialog}
      footer={(layout) => (
        <>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={dismiss}
            data-testid={testIds?.cancel ?? CONFIRM_TEST_IDS.cancel}
            className={CONFIRM_BUTTON_CLASS[layout]}
          >
            {cancelLabel ?? t(CONFIRM_KEYS.cancel)}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={busy}
            isLoading={busy}
            data-testid={testIds?.accept ?? CONFIRM_TEST_IDS.accept}
            className={CONFIRM_BUTTON_CLASS[layout]}
          >
            {confirmLabel ?? t(CONFIRM_KEYS.accept)}
          </Button>
        </>
      )}
    />
  );
}

/**
 * Shared confirmation for destructive / irreversible actions, in one frame for
 * every surface: a full-height panel at the inline end from `md`, a bottom
 * sheet below (`ConfirmPanel`). By default the plain confirm (remove a member,
 * delete a role or API key, delete an organization, discard changes); with
 * `reason` the clinic rooms' reason confirm — the schema's `delete_reason`
 * chips, a note, and Undo for 10s after the write (KICKOFF §3.5). Either way it
 * holds its busy state across the async confirm and blocks dismissal while in
 * flight.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  if (props.reason) return <ReasonConfirm {...props} />;
  return <PlainConfirmDialog {...props} />;
}
