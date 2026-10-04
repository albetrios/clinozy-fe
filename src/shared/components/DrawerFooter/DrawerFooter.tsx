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
  onSave?: () => void;
  saveState?: DrawerSaveState;
  /** "Save & add another", where the screen offers it — never on a phone. */
  onSaveAndAdd?: () => void;
  saveAndAddLabel?: string;
  /** Shown only when the record can be deleted; the caller opens the confirm. */
  onDelete?: () => void;
  deleteLabel?: string;
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

type EditActionsProps = Omit<DrawerFooterProps, 'summary' | 'readOnly'>;

/** Delete · Cancel / Back · Save & add another · the failure note · the primary. */
function EditActions({
  stacked,
  onDismiss,
  dismissLabel,
  saveLabel,
  onSave,
  saveState,
  onSaveAndAdd,
  saveAndAddLabel,
  onDelete,
  deleteLabel,
  testId,
}: EditActionsProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const tier = useViewportTier();
  const saving = saveState === 'saving';
  const failed = saveState === 'failed';

  let primaryLabel = saveLabel ?? t(RECORD_DRAWER_KEYS.save);
  if (saving) primaryLabel = t(RECORD_DRAWER_KEYS.saving);
  else if (failed) primaryLabel = t(RECORD_DRAWER_KEYS.retrySave);

  return (
    <>
      {onDelete ? (
        <Button
          type="button"
          variant="destructive"
          disabled={saving}
          onClick={onDelete}
          data-testid={`${testId}-delete`}
          className={FOOTER_BUTTON}
        >
          {deleteLabel ?? t(RECORD_DRAWER_KEYS.delete)}
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={onDismiss}
        data-testid={`${testId}-dismiss`}
        className={FOOTER_BUTTON}
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
          className={FOOTER_BUTTON}
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
          <span className="truncate">{t(RECORD_DRAWER_KEYS.notSaved)}</span>
        </span>
      ) : null}

      {onSave ? (
        <Button
          type="button"
          disabled={saving}
          aria-busy={saving || undefined}
          onClick={onSave}
          data-testid={`${testId}-save`}
          className={cn(FOOTER_BUTTON, 'px-4')}
        >
          {primaryLabel}
        </Button>
      ) : null}
    </>
  );
}

/**
 * The record drawer's footer (`_patterns.md:35–36`, H:938–945): summary ·
 * "Delete" · close ("Cancel", "Back" in a stacked child, "Close" when
 * read-only) · "Save & add another" · "Not saved · your changes are kept"
 * after a failed save · the primary ("Saving…", "Retry save"). Below `md` it
 * wraps: buttons share the row at 44px, the failure note takes its own row and
 * the summary drops to the last one, centred, hidden when empty.
 */
export function DrawerFooter({
  summary,
  readOnly = false,
  ...actions
}: DrawerFooterProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);

  return (
    <div
      data-testid={`${actions.testId}-footer`}
      className="flex shrink-0 flex-wrap items-center gap-2 border-t p-(--drawer-footer-pad) md:flex-nowrap md:gap-2.5"
    >
      <span
        data-testid={`${actions.testId}-summary`}
        className="text-detail text-muted-foreground min-w-0 flex-1 truncate max-md:order-last max-md:basis-full max-md:text-center max-md:text-xs max-md:leading-[1.3] max-md:whitespace-normal max-md:empty:hidden"
      >
        {readOnly ? t(RECORD_DRAWER_KEYS.readOnly) : summary}
      </span>

      {readOnly ? (
        <Button
          type="button"
          variant="outline"
          onClick={actions.onDismiss}
          data-testid={`${actions.testId}-dismiss`}
          className={FOOTER_BUTTON}
        >
          {t(RECORD_DRAWER_KEYS.close)}
        </Button>
      ) : (
        <EditActions {...actions} />
      )}
    </div>
  );
}
