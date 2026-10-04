import {
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerFooter,
  type DrawerSaveState,
} from '@/shared/components/DrawerFooter/index.ts';
import { type DrawerStep, DrawerSteps } from '@/shared/components/DrawerSteps/index.ts';
import {
  type QuickFillItem,
  QuickFillRow,
} from '@/shared/components/QuickFillRow/index.ts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/shared/components/ui/sheet.tsx';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { RECORD_DRAWER_TEST_ID } from './record-drawer.constants.ts';
import {
  RECORD_DRAWER_OVERLAY_CLASS,
  RECORD_DRAWER_PANEL_CLASS,
  RecordDrawerClose,
} from './record-drawer-chrome.tsx';
import { DrawerItemsContext, withMountedItems } from './record-drawer-items.ts';
import {
  DRAWER_WIDTH_CLASS,
  type DrawerContentProfile,
  type ExplicitDrawerWidth,
  resolveDrawerWidth,
} from './record-drawer-width.ts';

/** A 24px pill in the strip under the header (status, type, counts). */
export interface DrawerBadge {
  id: string;
  label: string;
  /** The pill's tone; untoned pills sit on `muted`. */
  tone?: Tone;
}

/** Props of {@link RecordDrawer}. */
export interface RecordDrawerProps {
  /** Controlled: URL-driven drawers pass `true` and close by navigating. */
  open: boolean;
  /**
   * Called once the user's close is settled: at once when nothing is dirty,
   * after "Discard" otherwise. Never called while a save is in flight.
   */
  onClose: () => void;
  /** Header title (18px/600) and the dialog's accessible name; takes focus on open. */
  title: string;
  /** Grey tag pill beside the title, e.g. the record's "#273". */
  tag?: string;
  /** Sub line under the title (13px, muted) and the dialog's description. */
  sub?: string;
  /**
   * The screen-sized header of New lead (H:1888): a 20px title over a 12.5px
   * sub line, where the record drawers set 18px over 13px.
   */
  largeTitle?: boolean;
  /**
   * What takes focus on open instead of the title — New lead's search while it
   * shows (`leads.md:150`); when the ref is empty the title takes it.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  badges?: readonly DrawerBadge[];
  /** Presets that prefill the form ("⚡ <label>"); hidden on a read-only drawer. */
  quickFill?: readonly QuickFillItem[];
  /**
   * The form's shape, for the automatic width (840 / 560 / 680). A mounted
   * `ItemsField` reports `hasItems` itself; declare it here when the items
   * table sits in a step that starts collapsed (its fields are not mounted).
   */
  content?: DrawerContentProfile;
  /** An explicit width; an items field still forces at least 840px. */
  width?: ExplicitDrawerWidth;
  /** The room's section tone (the open step's number circle). */
  tone?: Tone;
  /** Step cards, in order; without them the body is just `children`. */
  steps?: readonly DrawerStep[];
  /** Controlled open step ('' collapses every card). */
  openStep?: string;
  /** The step open at first when uncontrolled; the first step by default. */
  defaultOpenStep?: string;
  onOpenStepChange?: (stepId: string) => void;
  /**
   * Save found a required field still empty: the drawer has opened that step,
   * and the screen names the field (its toast copy is per room).
   */
  onMissing?: (stepId: string, missing: readonly string[]) => void;
  /** Body content above the steps (a notice), or the whole body without steps. */
  children?: ReactNode;
  /** Footer summary (ellipsis; a phone gives it its own last row). */
  summary?: string;
  /** View only: "Close", no Save / Delete / Quick fill, and the read-only note. */
  readOnly?: boolean;
  /** A child stacked on a parent drawer: the close button reads "Back". */
  stacked?: boolean;
  /** The close button's own words ("Nothing next"), in place of Cancel / Back. */
  dismissLabel?: string;
  saveLabel?: string;
  onSave?: () => void;
  saveState?: DrawerSaveState;
  saveAndAddLabel?: string;
  /** Offered where the screen passes it, never on a phone. */
  onSaveAndAdd?: () => void;
  deleteLabel?: string;
  /** Shown when the record can be deleted; the screen opens its confirm. */
  onDelete?: () => void;
  /** Unsaved edits: every exit and the browser Back ask before discarding. */
  dirty?: boolean;
  /** Root test id; the parts derive theirs (`<testId>-save`, `-close` …). */
  testId?: string;
}

/** Title (focused on open) with its tag pill, the sub line, and the phone ×. */
function DrawerHeader({
  title,
  tag,
  sub,
  large,
  titleRef,
  close,
  testId,
}: {
  title: string;
  tag?: string;
  sub?: string;
  large: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  close: ReactNode;
  testId: string;
}) {
  return (
    <div className="relative flex h-(--drawer-header-height) shrink-0 items-center overflow-hidden border-b p-(--drawer-header-pad) max-md:pe-14">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <SheetTitle
            ref={titleRef}
            tabIndex={-1}
            data-testid={`${testId}-title`}
            className={cn(
              'min-w-0 truncate tracking-[-0.01em] outline-none',
              large ? 'text-xl leading-[1.2]' : 'text-lg',
            )}
          >
            {title}
          </SheetTitle>
          {tag ? (
            <span
              data-testid={`${testId}-tag`}
              className="bg-muted text-caption text-muted-foreground-strong inline-flex h-5.5 shrink-0 items-center rounded-md px-1.5 font-medium whitespace-nowrap tabular-nums"
            >
              {tag}
            </span>
          ) : null}
        </div>
        {sub ? (
          <SheetDescription
            className={cn('truncate', large ? 'text-detail' : 'text-body')}
          >
            {sub}
          </SheetDescription>
        ) : null}
      </div>
      {close}
    </div>
  );
}

/** The 24px pill strip under the header, sharing its hairline; nothing when empty. */
function DrawerBadges({
  badges,
  testId,
}: {
  badges: readonly DrawerBadge[];
  testId: string;
}) {
  if (badges.length === 0) return null;
  return (
    <div
      data-testid={`${testId}-badges`}
      className="bg-background -mt-px flex shrink-0 flex-wrap gap-1.5 border-b px-(--drawer-pad-x) py-2.5"
    >
      {badges.map((badge) => (
        <span
          key={badge.id}
          data-slot="pill"
          className={cn(
            'inline-block h-6 max-w-full truncate rounded-full px-2.5 text-xs leading-6 font-medium tabular-nums',
            badge.tone
              ? TONE_CLASSES[badge.tone].surface
              : 'bg-muted text-muted-foreground-strong',
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

/** The open step, controlled (`openStep`) or the drawer's own. */
function useOpenStep({
  steps,
  openStep,
  defaultOpenStep,
  onOpenStepChange,
}: Pick<
  RecordDrawerProps,
  'steps' | 'openStep' | 'defaultOpenStep' | 'onOpenStepChange'
>) {
  const [ownStep, setOwnStep] = useState(() => defaultOpenStep ?? steps?.[0]?.id ?? '');
  const select = (stepId: string) => {
    if (openStep === undefined) setOwnStep(stepId);
    onOpenStepChange?.(stepId);
  };
  return [openStep ?? ownStep, select] as const;
}

/**
 * Whether an item-rows table has reported itself since the drawer opened
 * (`useDrawerItemsField`); a closed drawer forgets it.
 */
function useMountedItems(open: boolean) {
  const [itemsMounted, setItemsMounted] = useState(false);
  if (!open && itemsMounted) setItemsMounted(false);
  const markItems = useCallback(() => setItemsMounted(true), []);
  return [itemsMounted, markItems] as const;
}

/**
 * The drawer's exits and writes: every exit (×, Cancel / Back / Close,
 * backdrop, Esc) is held while the write runs (§26) and asks before
 * discarding while dirty (Q-P1, browser Back included); Save is never
 * disabled — a required field still empty opens its step instead.
 */
function useDrawerActions(
  props: RecordDrawerProps,
  selectStep: (stepId: string) => void,
) {
  const saving = props.saveState === 'saving';
  const { guardDialog, confirmDiscard } = useUnsavedChangesGuard({
    when: props.open && Boolean(props.dirty) && !props.readOnly && !saving,
  });

  const requestClose = () => {
    if (!saving) confirmDiscard(props.onClose);
  };

  const guardSave = (action: (() => void) | undefined) => {
    if (!action) return undefined;
    return () => {
      if (saving) return;
      const blocked = props.steps?.find((step) => (step.missing?.length ?? 0) > 0);
      if (!blocked) {
        action();
        return;
      }
      selectStep(blocked.id);
      props.onMissing?.(blocked.id, blocked.missing ?? []);
    };
  };

  return {
    guardDialog,
    requestClose,
    onSave: guardSave(props.onSave),
    onSaveAndAdd: guardSave(props.onSaveAndAdd),
  };
}

/**
 * Focus starts on the title (`_patterns.md:38`, §7.2) — or on what the screen
 * names instead — and goes back to whatever was focused when the drawer opened:
 * URL-driven drawers have no Radix trigger for the sheet to return to.
 */
function useTitleFocus(initialFocusRef?: RefObject<HTMLElement | null>) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return {
    titleRef,
    onOpenAutoFocus: (event: Event) => {
      const previous = document.activeElement;
      returnFocusRef.current = previous instanceof HTMLElement ? previous : null;
      event.preventDefault();
      (initialFocusRef?.current ?? titleRef.current)?.focus();
    },
    onCloseAutoFocus: (event: Event) => {
      const target = returnFocusRef.current;
      if (!target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}

/**
 * The record drawer (`mkDrawer`, H:3754–3853) on the shadcn `sheet`, anchored
 * to the inline end: `min(W, 100vw − 56px)` from `md` up with the floating ×
 * outside its edge, the full screen below `md` with the × inside the 60px
 * header and a wrapping 44px footer. It carries the header (title, tag, sub
 * line, badges, Quick fill), the body (`children`, then the step cards) and
 * the footer. Every exit — ×, Cancel / Back / Close, backdrop, Esc and the
 * browser Back — asks before discarding a dirty drawer (Q-P1) and is held while
 * a save runs (§26). Focus starts on the title and returns to whatever opened
 * the drawer. Screens supply the fields; stacked children are component state
 * ({@link RecordDrawerProps.stacked}).
 */
export function RecordDrawer(props: RecordDrawerProps) {
  const testId = props.testId ?? RECORD_DRAWER_TEST_ID;
  const phone = useViewportTier() === 'phone';
  const { titleRef, onOpenAutoFocus, onCloseAutoFocus } = useTitleFocus(
    props.initialFocusRef,
  );
  const [currentStep, selectStep] = useOpenStep(props);
  const [itemsMounted, markItems] = useMountedItems(props.open);
  const { guardDialog, requestClose, onSave, onSaveAndAdd } = useDrawerActions(
    props,
    selectStep,
  );
  const close = (placement: 'floating' | 'inside') => (
    <RecordDrawerClose placement={placement} onClose={requestClose} testId={testId} />
  );

  return (
    <Sheet
      open={props.open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <SheetContent
        side="end"
        showCloseButton={false}
        overlayClassName={RECORD_DRAWER_OVERLAY_CLASS}
        data-testid={testId}
        // Without a sub line there is no description to point at.
        {...(props.sub ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          RECORD_DRAWER_PANEL_CLASS,
          DRAWER_WIDTH_CLASS[
            resolveDrawerWidth(withMountedItems(props.content, itemsMounted), props.width)
          ],
        )}
      >
        {phone ? null : close('floating')}
        <DrawerHeader
          title={props.title}
          tag={props.tag}
          sub={props.sub}
          large={props.largeTitle ?? false}
          titleRef={titleRef}
          testId={testId}
          close={phone ? close('inside') : null}
        />
        <DrawerBadges badges={props.badges ?? []} testId={testId} />
        <QuickFillRow
          items={props.readOnly ? [] : (props.quickFill ?? [])}
          testId={testId}
        />

        <div
          data-testid={`${testId}-body`}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-(--drawer-body-pad)"
        >
          <DrawerItemsContext.Provider value={markItems}>
            {props.children}
            <DrawerSteps
              steps={props.steps ?? []}
              value={currentStep}
              onValueChange={selectStep}
              tone={props.tone}
              testId={testId}
            />
          </DrawerItemsContext.Provider>
        </div>

        <DrawerFooter
          summary={props.summary}
          readOnly={props.readOnly}
          stacked={props.stacked}
          onDismiss={requestClose}
          dismissLabel={props.dismissLabel}
          saveLabel={props.saveLabel}
          onSave={onSave}
          saveState={props.saveState}
          saveAndAddLabel={props.saveAndAddLabel}
          onSaveAndAdd={onSaveAndAdd}
          deleteLabel={props.deleteLabel}
          onDelete={props.onDelete}
          testId={testId}
        />
        {guardDialog}
      </SheetContent>
    </Sheet>
  );
}
