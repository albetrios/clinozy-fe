import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

/**
 * Where the drawer's write stands: `saving` while it is in flight ("Saving…",
 * every exit held), `failed` after it was rejected ("Not saved · your changes
 * are kept" and "Retry save").
 */
export type DrawerSaveState = 'idle' | 'saving' | 'failed';

/** Props of {@link DrawerFooter}. */
export interface DrawerFooterProps {
  /** Left-hand summary of the record; on a phone it drops to its own last row. */
  summary?: string;
  /** View only: "Close", no Save / Delete, and the read-only summary. */
  readOnly?: boolean;
  /** A child drawer stacked on a parent: the close button reads "Back". */
  stacked?: boolean;
  /** Cancel / Back / Close — the caller guards it like every other exit. */
  onDismiss: () => void;
  /** The dismiss button's own words ("Nothing next"), in place of Cancel / Back. */
  dismissLabel?: string;
  /** Primary label (the screen's own, e.g. "Create patient"); "Save" by default. */
  saveLabel?: string;
  /** The primary's words while the write runs ("Creating…"); "Saving…" by default. */
  savingLabel?: string;
  onSave?: () => void;
  /**
   * The id of a `<form>` in the drawer that the primary submits (`type="submit"`):
   * the form's own submit runs in place of `onSave`, and Enter in its fields
   * saves too.
   */
  saveFormId?: string;
  saveState?: DrawerSaveState;
  /**
   * Nothing to save yet — an edit form before its first change (Q-P1): the
   * primary is disabled. Record drawers otherwise never disable it.
   */
  saveDisabled?: boolean;
  /**
   * The record is not complete yet: the primary sits at 50% but still runs,
   * and the screen's save names what is missing (the appointment form, H:5983).
   */
  saveIncomplete?: boolean;
  /** 32px buttons from `md` (the appointment form's footer, H:2831); 36px by default. */
  compact?: boolean;
  /** "Save & add another", where the screen offers it — never on a phone. */
  onSaveAndAdd?: () => void;
  saveAndAddLabel?: string;
  /** The failed save's note — "Not saved · your changes are kept" by default. */
  notSavedLabel?: string;
  /** Shown only when the record can be deleted; the caller opens the confirm. */
  onDelete?: () => void;
  deleteLabel?: string;
  /**
   * Controls before the buttons, in place of the summary — the task drawer's
   * Snooze and Assigned (`tasks.md` › Task drawer › Footer).
   */
  start?: ReactNode;
  /** The primary's test id, for a drawer whose specs already name it (`<testId>-save` by default). */
  saveTestId?: string;
  /** Delete's test id, likewise (`<testId>-delete` by default). */
  deleteTestId?: string;
  /** Cancel / Back / Close's test id, likewise (`<testId>-dismiss` by default). */
  dismissTestId?: string;
  /** Prefix for the footer's test ids (`<testId>-save` …). */
  testId: string;
}

/**
 * The footer's 36px buttons. On a phone they share the row at 44px, each
 * growing from its own width (`flex: 1 1 auto`, H:38), so a long primary label
 * keeps the room it needs.
 */
const FOOTER_BUTTON =
  'text-body h-9 rounded-lg px-3.5 max-md:h-11 max-md:flex-auto max-md:px-3';

/** The compact footer's 32px buttons from `md` (still 44px on a phone). */
const COMPACT_BUTTON = 'md:h-8';

type EditActionsProps = Omit<DrawerFooterProps, 'summary' | 'readOnly' | 'start'>;

/**
 * The primary: "Saving…" (or the screen's own words) while a save runs, "Retry
 * save" after one failed; disabled until there is something to save, at 50%
 * while incomplete. With `saveFormId` it is that form's submit button.
 */
function PrimaryAction({
  saveLabel,
  savingLabel,
  onSave,
  saveFormId,
  saveState,
  saveDisabled,
  saveIncomplete,
  className,
  saveTestId,
  testId,
}: Pick<
  EditActionsProps,
  | 'saveLabel'
  | 'savingLabel'
  | 'onSave'
  | 'saveFormId'
  | 'saveState'
  | 'saveDisabled'
  | 'saveIncomplete'
  | 'saveTestId'
  | 'testId'
> & { className: string }) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const saving = saveState === 'saving';
  let label = saveLabel ?? t(RECORD_DRAWER_KEYS.save);
  if (saving) label = savingLabel ?? t(RECORD_DRAWER_KEYS.saving);
  else if (saveState === 'failed') label = t(RECORD_DRAWER_KEYS.retrySave);
  return (
    <Button
      type={saveFormId ? 'submit' : 'button'}
      form={saveFormId}
      disabled={saving || saveDisabled}
      aria-busy={saving || undefined}
      data-incomplete={saveIncomplete || undefined}
      onClick={saveFormId ? undefined : onSave}
      data-testid={saveTestId ?? `${testId}-save`}
      className={cn(className, 'px-4', saveIncomplete && 'opacity-50')}
    >
      {label}
    </Button>
  );
}

/** Delete · Cancel / Back · Save & add another · the failure note · the primary. */
function EditActions({
  stacked,
  onDismiss,
  dismissLabel,
  saveLabel,
  savingLabel,
  onSave,
  saveFormId,
  saveState,
  saveDisabled,
  saveIncomplete,
  compact,
  onSaveAndAdd,
  saveAndAddLabel,
  notSavedLabel,
  onDelete,
  deleteLabel,
  saveTestId,
  deleteTestId,
  dismissTestId,
  testId,
}: EditActionsProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const tier = useViewportTier();
  const saving = saveState === 'saving';
  const failed = saveState === 'failed';
  const button = cn(FOOTER_BUTTON, compact && COMPACT_BUTTON);

  return (
    <>
      {onDelete ? (
        <Button
          type="button"
          variant="destructive"
          disabled={saving}
          onClick={onDelete}
          data-testid={deleteTestId ?? `${testId}-delete`}
          className={button}
        >
          {deleteLabel ?? t(RECORD_DRAWER_KEYS.delete)}
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={onDismiss}
        data-testid={dismissTestId ?? `${testId}-dismiss`}
        className={button}
      >
        {dismissLabel ?? t(stacked ? RECORD_DRAWER_KEYS.back : RECORD_DRAWER_KEYS.cancel)}
      </Button>

      {onSaveAndAdd && tier !== 'phone' ? (
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onSaveAndAdd}
          data-testid={`${testId}-save-and-add`}
          className={button}
        >
          {saveAndAddLabel ?? t(RECORD_DRAWER_KEYS.saveAndAdd)}
        </Button>
      ) : null}

      {failed ? (
        // A full row of buttons squeezes the note: it ellipsises rather than
        // running under "Retry save" (the design's nowrap note overflowed).
        <span
          role="alert"
          data-testid={`${testId}-not-saved`}
          className="text-destructive inline-flex min-w-0 items-center gap-1.5 text-xs font-medium max-md:order-first max-md:basis-full max-md:justify-center"
        >
          <span
            aria-hidden="true"
            className="bg-destructive size-1.5 shrink-0 rounded-full"
          />
          <span className="truncate">
            {notSavedLabel ?? t(RECORD_DRAWER_KEYS.notSaved)}
          </span>
        </span>
      ) : null}

      {onSave || saveFormId ? (
        <PrimaryAction
          saveLabel={saveLabel}
          savingLabel={savingLabel}
          onSave={onSave}
          saveFormId={saveFormId}
          saveState={saveState}
          saveDisabled={saveDisabled}
          saveIncomplete={saveIncomplete}
          className={button}
          saveTestId={saveTestId}
          testId={testId}
        />
      ) : null}
    </>
  );
}

/**
 * The record drawer's footer (`_patterns.md:35–36`, H:938–945): summary ·
 * "Delete" · close ("Cancel", "Back" in a stacked child, "Close" when
 * read-only) · "Save & add another" · "Not saved · your changes are kept"
 * after a failed save · the primary ("Saving…", "Retry save"). Below `md` it
 * wraps: the start controls take a row of their own (the task drawer's Snooze
 * and Assigned), buttons share the row at 44px, the failure note takes its own row and
 * the summary drops to the last one, centred, hidden when empty. `compact` is
 * the appointment form's footer: 32px buttons and a 13px summary (H:2831).
 */
export function DrawerFooter({
  summary,
  readOnly = false,
  start,
  ...actions
}: DrawerFooterProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);

  return (
    <div
      data-testid={`${actions.testId}-footer`}
      className="flex shrink-0 flex-wrap items-center gap-2 border-t p-(--drawer-footer-pad) md:flex-nowrap md:gap-2.5"
    >
      {start ? (
        <div
          data-testid={`${actions.testId}-start`}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 max-md:basis-full"
        >
          {start}
        </div>
      ) : null}
      <span
        data-testid={`${actions.testId}-summary`}
        className={cn(
          'text-detail text-muted-foreground min-w-0 flex-1 truncate max-md:order-last max-md:basis-full max-md:text-center max-md:text-xs max-md:leading-[1.3] max-md:whitespace-normal max-md:empty:hidden',
          actions.compact && 'md:text-body md:text-muted-foreground-strong',
          // The start controls take the free room; an empty summary steps aside.
          start && 'empty:hidden',
        )}
      >
        {readOnly ? t(RECORD_DRAWER_KEYS.readOnly) : summary}
      </span>

      {readOnly ? (
        <Button
          type="button"
          variant="outline"
          onClick={actions.onDismiss}
          data-testid={actions.dismissTestId ?? `${actions.testId}-dismiss`}
          className={cn(FOOTER_BUTTON, actions.compact && COMPACT_BUTTON)}
        >
          {t(RECORD_DRAWER_KEYS.close)}
        </Button>
      ) : (
        <EditActions {...actions} />
      )}
    </div>
  );
}
