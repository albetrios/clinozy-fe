import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useState,
} from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  DrawerFooter,
  type DrawerSaveState,
} from '@/shared/components/DrawerFooter/index.ts';
import { type DrawerStep, DrawerSteps } from '@/shared/components/DrawerSteps/index.ts';
import { useEnterAnimationProps } from '@/shared/components/LazyOverlay/index.ts';
import {
  type QuickFillItem,
  QuickFillRow,
} from '@/shared/components/QuickFillRow/index.ts';
import { RoomViewTabs } from '@/shared/components/RoomToolbar/RoomTabs/index.ts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/shared/components/ui/sheet.tsx';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type { AppIcon } from '@/shared/icons/index.ts';

import { RECORD_DRAWER_TEST_ID } from './record-drawer.constants.ts';
import {
  RECORD_DRAWER_OVERLAY_CLASS,
  RECORD_DRAWER_PANEL_CLASS,
  RecordDrawerClose,
} from './record-drawer-chrome.tsx';
import { useDrawerTitleFocus } from './record-drawer-focus.ts';
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

/**
 * The phone's two panes when the drawer has a column (the lead drawer's
 * Details · Chat, `leads.md:136`): a switch under the header picks the form
 * or the column, one at a time.
 */
interface RecordDrawerPanes {
  /** The switch's accessible name ("Lead panes"). */
  label: string;
  /** The form's tab and the column's — each `id` names its tab's test id. */
  form: { id: string; label: string; icon?: AppIcon };
  aside: { id: string; label: string; icon?: AppIcon };
  /** The pane shown — the screen may keep it between records. */
  value: 'form' | 'aside';
  onValueChange: (pane: 'form' | 'aside') => void;
  /** The switch's test ids: `<prefix>-tabs`, `<prefix>-tab-<pane id>`. */
  testIdPrefix: string;
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
  /**
   * Header title (18px/600) and the dialog's accessible name; takes focus on
   * open. It reads in its own direction (a record's name on a right-to-left page).
   */
  title: string;
  /** Grey tag pill beside the title, e.g. the record's "#273" — in its own direction. */
  tag?: string;
  /**
   * Controls on the title's row after it (and the tag) — the lead drawer's ID
   * to copy and its "Re-target" pill (H:1755).
   */
  titleEnd?: ReactNode;
  /** Before the title: a leading tile — the task drawer's 36px rule icon. */
  headerStart?: ReactNode;
  /** At the header's inline end: Stock check's "2 of 10 counted". */
  headerEnd?: ReactNode;
  /**
   * Sub line under the title (13px, muted) and the dialog's description. It
   * keeps the page's direction — a translated sentence often leads with a name
   * — so the caller isolates each data token in it (`isolateValues`).
   */
  sub?: string;
  /**
   * Below `md` the sub line is only read out, not shown — Stock check keeps
   * its title and counter on a phone (`clinic-stock.md:263`).
   */
  hideSubOnPhone?: boolean;
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
  /**
   * A band under the header, edge to edge, that stays put while the body
   * scrolls — the contact editor's tinted band (H:1967). The caller draws it.
   */
  band?: ReactNode;
  /**
   * Presets that prefill the form ("⚡ <label>"); hidden on a read-only drawer,
   * but for a chip that opens another record (`keepWhenReadOnly`).
   */
  quickFill?: readonly QuickFillItem[];
  /**
   * A strip under the Quick fill row that stays put while the body scrolls —
   * the drawer's type switch (H:1024 `switchOpts`; the Invoice drawer's Clinic
   * · Medical · Consultation).
   */
  headerStrip?: ReactNode;
  /**
   * A strip between the body and the footer that stays put while the body
   * scrolls — the Invoice drawer's totals (KICKOFF §6.9).
   */
  footerStrip?: ReactNode;
  /**
   * The form's shape, for the automatic width (840 / 560 / 680). A mounted
   * `ItemsField` reports `hasItems` itself; declare it here when the items
   * table sits in a step that starts collapsed (its fields are not mounted).
   */
  content?: DrawerContentProfile;
  /** An explicit width; an items field still forces at least 840px. */
  width?: ExplicitDrawerWidth;
  /**
   * The width from `md`, in px, when the screen measures it itself — the
   * appointment form's `min(760, max(560, vw − 56))` and its form + chat rule
   * (KICKOFF §6.4). It replaces `width` and the automatic width.
   */
  panelWidth?: number;
  /**
   * A column at the drawer's inline end from `md` — the appointment form's,
   * the task drawer's and the lead drawer's chat (KICKOFF §6.4, §6.10, §6.3):
   * its content and its width in px, inside `panelWidth`. The form keeps the
   * rest behind a hairline. On a phone it is not rendered — unless `panes`
   * makes it the drawer's second pane behind a switch under the header.
   */
  aside?: { content: ReactNode; width: number; panes?: RecordDrawerPanes };
  /**
   * The floating ×: the record drawers' (`record`, 14px outside, `rounded-xl`,
   * no border — `_patterns.md:30`) or the form drawers' (`form`, 10px outside,
   * `rounded-lg` with a hairline — the appointment form and the lead forms,
   * H:2742, H:1886).
   */
  closeStyle?: 'record' | 'form';
  /** The room's section tone (the open step's number circle). */
  tone?: Tone;
  /** Step cards, in order; without them the body is just `children`. */
  steps?: readonly DrawerStep[];
  /** Controlled open step ('' collapses every card). */
  openStep?: string;
  /**
   * The open step can be folded away (the default); New lead's stays open, so
   * its head shows no chevron.
   */
  stepsCollapsible?: boolean;
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
  /**
   * The body without its padding and gap, for content that runs edge to edge
   * and pads its own rows — Stock check's count grid (`clinic-stock.md:78`).
   */
  flushBody?: boolean;
  /** The body's own surface and spacing — Day close's canvas under its cards. */
  bodyClassName?: string;
  /** Footer summary (ellipsis; a phone gives it its own last row). */
  summary?: string;
  /** Controls before the footer's buttons, in place of the summary (the task drawer's Snooze, Assigned). */
  footerStart?: ReactNode;
  /** No footer: a drawer whose actions sit in its body (Day close's bar). */
  hideFooter?: boolean;
  /**
   * View only: "Close", no Save / Delete, no Quick fill but a chip that opens
   * another record (`keepWhenReadOnly`), and the read-only note.
   */
  readOnly?: boolean;
  /**
   * The work is done (a payment received): the footer's one button, with these words, closes the
   * drawer — no Cancel, no Save.
   */
  doneLabel?: string;
  /** A child stacked on a parent drawer: the close button reads "Back". */
  stacked?: boolean;
  /** The close button's own words ("Nothing next"), in place of Cancel / Back. */
  dismissLabel?: string;
  /**
   * The footer's dismiss button does this instead of closing — the lead
   * drawer's "Discard" puts its draft back in place while it is dirty.
   */
  onDismiss?: () => void;
  saveLabel?: string;
  /** The primary's words while the write runs ("Creating…"); "Saving…" by default. */
  savingLabel?: string;
  onSave?: () => void;
  /**
   * The id of a `<form>` in the body that the primary submits (`type="submit"`),
   * in place of `onSave`: Enter in its fields saves too. A drawer with steps
   * saves through `onSave`, which opens the step with a gap.
   */
  saveFormId?: string;
  /** The primary's test id where the specs already name it (`<testId>-save` by default). */
  saveTestId?: string;
  saveState?: DrawerSaveState;
  /** Nothing to save yet (an edit before its first change, Q-P1): the primary is disabled. */
  saveDisabled?: boolean;
  /** Not complete yet: the primary at 50%, still clickable — the screen names what is missing. */
  saveIncomplete?: boolean;
  /** The form drawers' footer: 32px buttons and a 13px summary (H:2831). */
  compactFooter?: boolean;
  saveAndAddLabel?: string;
  /** Offered where the screen passes it, never on a phone. */
  onSaveAndAdd?: () => void;
  deleteLabel?: string;
  /** Shown when the record can be deleted; the screen opens its confirm. */
  onDelete?: () => void;
  /** Delete's test id where the specs already name it (`<testId>-delete` by default). */
  deleteTestId?: string;
  /** Cancel / Back / Close's test id where the specs already name it (`<testId>-dismiss` by default). */
  dismissTestId?: string;
  /** The failed save's note in the screen's words ("Not saved · your counts are kept"). */
  notSavedLabel?: string;
  /** Unsaved edits: every exit and the browser Back ask before discarding. */
  dirty?: boolean;
  /**
   * Esc on the drawer, before it closes: an inline edit inside takes it first
   * (the contact editor's "+ Custom") by calling `event.preventDefault()`.
   */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Root test id; the parts derive theirs (`<testId>-save`, `-close` …). */
  testId?: string;
  /** The ×'s test id where the specs already name it (`<testId>-close` by default). */
  closeTestId?: string;
}

/** Title (focused on open) with its tag pill, the sub line, and the phone ×. */
function DrawerHeader({
  title,
  tag,
  titleEnd,
  start,
  sub,
  hideSubOnPhone,
  end,
  large,
  titleRef,
  close,
  testId,
}: {
  title: string;
  tag?: string;
  titleEnd?: ReactNode;
  start?: ReactNode;
  sub?: string;
  hideSubOnPhone: boolean;
  end?: ReactNode;
  large: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  close: ReactNode;
  testId: string;
}) {
  // On a phone a long sub wraps to a second line, as the design's does, and the
  // header grows past its 60px instead of cutting it.
  return (
    <div className="relative flex h-(--drawer-header-height) shrink-0 items-center gap-3 overflow-hidden border-b p-(--drawer-header-pad) max-md:h-auto max-md:min-h-(--drawer-header-height) max-md:pe-14">
      {start ? <div className="flex flex-none items-center">{start}</div> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <SheetTitle
            ref={titleRef}
            tabIndex={-1}
            dir="auto"
            data-testid={`${testId}-title`}
            className={cn(
              'min-w-0 truncate [text-align:match-parent] tracking-[-0.01em] outline-none',
              large ? 'text-xl leading-[1.2]' : 'text-lg',
            )}
          >
            {title}
          </SheetTitle>
          {tag ? (
            <span
              dir="auto"
              data-testid={`${testId}-tag`}
              className="bg-muted text-caption text-muted-foreground-strong inline-flex h-5.5 shrink-0 items-center rounded-md px-1.5 font-medium whitespace-nowrap tabular-nums"
            >
              {tag}
            </span>
          ) : null}
          {titleEnd}
        </div>
        {sub ? (
          <SheetDescription
            className={cn(
              'truncate max-md:line-clamp-2 max-md:whitespace-normal',
              large ? 'text-detail' : 'text-body',
              hideSubOnPhone && 'max-md:sr-only',
            )}
          >
            {sub}
          </SheetDescription>
        ) : null}
      </div>
      {end ? (
        <div data-testid={`${testId}-header-end`} className="shrink-0">
          {end}
        </div>
      ) : null}
      {close}
    </div>
  );
}

/**
 * The 24px pill strip under the header, sharing its hairline; nothing when
 * empty. Each pill reads in its own direction ("Bill ₹324", a branch's name).
 */
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
          dir="auto"
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
  // A save tried with a required field empty flags every step that lacks one,
  // reached or not; a closed drawer forgets it.
  const [attempted, setAttempted] = useState(false);
  if (!props.open && attempted) setAttempted(false);
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
      setAttempted(true);
      selectStep(blocked.id);
      props.onMissing?.(blocked.id, blocked.missing ?? []);
    };
  };

  return {
    guardDialog,
    requestClose,
    attempted,
    onSave: guardSave(props.onSave),
    onSaveAndAdd: guardSave(props.onSaveAndAdd),
  };
}

/** The widths a screen measured itself, as the panel's CSS variables. */
function panelStyle(
  panelWidth: number | undefined,
  aside: { width: number } | undefined,
): CSSProperties | undefined {
  if (panelWidth === undefined && !aside) return undefined;
  return {
    ...(panelWidth === undefined ? {} : { '--drawer-panel-width': `${panelWidth}px` }),
    ...(aside ? { '--drawer-aside-width': `${aside.width}px` } : {}),
  } as CSSProperties;
}

/** The drawer's content: the form alone, or the form and the column at its inline end. */
function DrawerColumns({
  main,
  aside,
  testId,
}: {
  main: ReactNode;
  aside: ReactNode | undefined;
  testId: string;
}) {
  if (aside === undefined) return main;
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_var(--drawer-aside-width)]">
      <div
        data-testid={`${testId}-main`}
        className="flex min-h-0 min-w-0 flex-col border-e"
      >
        {main}
      </div>
      <div
        data-testid={`${testId}-aside`}
        className="relative flex min-h-0 min-w-0 flex-col"
      >
        {aside}
      </div>
    </div>
  );
}

/** A strip of the drawer that stays put while the body scrolls; nothing without content. */
function DrawerStrip({
  testId,
  className,
  children,
}: {
  testId: string;
  className?: string;
  children?: ReactNode;
}) {
  if (!children) return null;
  return (
    <div data-testid={testId} className={cn('shrink-0', className)}>
      {children}
    </div>
  );
}

/** The drawer's top: the header, its badges, the band and the phone's pane switch. */
function DrawerTop({
  props,
  testId,
  titleRef,
  close,
  panes,
}: {
  props: RecordDrawerProps;
  testId: string;
  titleRef: Ref<HTMLHeadingElement>;
  close: ReactNode;
  panes: RecordDrawerPanes | undefined;
}) {
  return (
    <>
      <DrawerHeader
        title={props.title}
        tag={props.tag}
        titleEnd={props.titleEnd}
        start={props.headerStart}
        end={props.headerEnd}
        sub={props.sub}
        hideSubOnPhone={props.hideSubOnPhone ?? false}
        large={props.largeTitle ?? false}
        titleRef={titleRef}
        testId={testId}
        close={close}
      />
      <DrawerBadges badges={props.badges ?? []} testId={testId} />
      {props.band ? <div className="shrink-0">{props.band}</div> : null}
      {panes ? <DrawerPaneSwitch panes={panes} /> : null}
    </>
  );
}

/** The form pane: Quick fill, the strips, the body (content, then the steps) and the footer. */
function DrawerForm({
  props,
  testId,
  step,
  onStepChange,
  revealMissing,
  markItems,
  onDismiss,
  onSave,
  onSaveAndAdd,
}: {
  props: RecordDrawerProps;
  testId: string;
  step: string;
  onStepChange: (stepId: string) => void;
  revealMissing: boolean;
  markItems: () => void;
  onDismiss: () => void;
  onSave?: () => void;
  onSaveAndAdd?: () => void;
}) {
  return (
    <>
      <QuickFillRow
        items={(props.quickFill ?? []).filter(
          (item) => !props.readOnly || item.keepWhenReadOnly,
        )}
        testId={testId}
      />
      <DrawerStrip testId={`${testId}-header-strip`} className="px-(--drawer-pad-x) pt-3">
        {props.headerStrip}
      </DrawerStrip>

      <div
        data-testid={`${testId}-body`}
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto',
          !props.flushBody && 'gap-3 p-(--drawer-body-pad)',
          props.bodyClassName,
        )}
      >
        <DrawerItemsContext.Provider value={markItems}>
          {props.children}
          <DrawerSteps
            steps={props.steps ?? []}
            value={step}
            onValueChange={onStepChange}
            tone={props.tone}
            revealMissing={revealMissing}
            collapsible={props.stepsCollapsible}
            testId={testId}
          />
        </DrawerItemsContext.Provider>
      </div>

      <DrawerStrip testId={`${testId}-footer-strip`}>{props.footerStrip}</DrawerStrip>
      {props.hideFooter ? null : (
        <DrawerFooter
          start={props.footerStart}
          summary={props.summary}
          readOnly={props.readOnly}
          doneLabel={props.doneLabel}
          stacked={props.stacked}
          onDismiss={props.onDismiss ?? onDismiss}
          dismissLabel={props.dismissLabel}
          saveLabel={props.saveLabel}
          savingLabel={props.savingLabel}
          onSave={onSave}
          saveFormId={props.saveFormId}
          saveState={props.saveState}
          saveDisabled={props.saveDisabled}
          saveIncomplete={props.saveIncomplete}
          compact={props.compactFooter}
          saveAndAddLabel={props.saveAndAddLabel}
          onSaveAndAdd={onSaveAndAdd}
          deleteLabel={props.deleteLabel}
          onDelete={props.onDelete}
          notSavedLabel={props.notSavedLabel}
          saveTestId={props.saveTestId}
          deleteTestId={props.deleteTestId}
          dismissTestId={props.dismissTestId}
          testId={testId}
        />
      )}
    </>
  );
}

/** The phone's form · column switch under the header (the lead drawer's Details · Chat). */
function DrawerPaneSwitch({ panes }: { panes: RecordDrawerPanes }) {
  return (
    <div className="shrink-0 border-b px-(--drawer-pad-x) py-2">
      <RoomViewTabs
        fill
        activation="automatic"
        label={panes.label}
        tabs={[
          { id: panes.form.id, label: panes.form.label, icon: panes.form.icon },
          { id: panes.aside.id, label: panes.aside.label, icon: panes.aside.icon },
        ]}
        value={panes.value === 'aside' ? panes.aside.id : panes.form.id}
        onValueChange={(id) =>
          panes.onValueChange(id === panes.aside.id ? 'aside' : 'form')
        }
        testIdPrefix={panes.testIdPrefix}
      />
    </div>
  );
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
 * ({@link RecordDrawerProps.stacked}). A screen that measures its own width
 * (`panelWidth`) can add a column at the inline end from `md` (`aside`) — the
 * appointment form's chat.
 */
export function RecordDrawer(props: RecordDrawerProps) {
  const testId = props.testId ?? RECORD_DRAWER_TEST_ID;
  const phone = useViewportTier() === 'phone';
  const { titleRef, onOpenAutoFocus, onCloseAutoFocus } = useDrawerTitleFocus(
    props.initialFocusRef,
  );
  const [currentStep, selectStep] = useOpenStep(props);
  const [itemsMounted, markItems] = useMountedItems(props.open);
  const { guardDialog, requestClose, attempted, onSave, onSaveAndAdd } = useDrawerActions(
    props,
    selectStep,
  );
  const close = (placement: 'floating' | 'inside') => (
    <RecordDrawerClose
      placement={placement}
      closeStyle={props.closeStyle}
      onClose={requestClose}
      testId={testId}
      closeTestId={props.closeTestId}
    />
  );
  // A lazy drawer whose placeholder already slid in does not slide in again.
  const enter = useEnterAnimationProps();
  const aside = phone ? undefined : props.aside;
  // On a phone a column with panes is the drawer's second pane.
  const panes = phone ? props.aside?.panes : undefined;

  const header = (
    <DrawerTop
      props={props}
      testId={testId}
      titleRef={titleRef}
      close={phone ? close('inside') : null}
      panes={panes}
    />
  );

  const form = (
    <DrawerForm
      props={props}
      testId={testId}
      step={currentStep}
      onStepChange={selectStep}
      revealMissing={attempted}
      markItems={markItems}
      onDismiss={requestClose}
      onSave={onSave}
      onSaveAndAdd={onSaveAndAdd}
    />
  );

  const main = (
    <>
      {header}
      {panes?.value === 'aside' ? (
        <div
          data-testid={`${testId}-aside`}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {props.aside?.content}
        </div>
      ) : (
        form
      )}
    </>
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
        overlayClassName={cn(
          RECORD_DRAWER_OVERLAY_CLASS,
          enter.style && 'data-[state=open]:animate-none',
        )}
        data-testid={testId}
        // Without a sub line there is no description to point at.
        {...(props.sub ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={props.onEscapeKeyDown}
        style={{ ...panelStyle(props.panelWidth, aside), ...enter.style }}
        className={cn(
          RECORD_DRAWER_PANEL_CLASS,
          props.panelWidth === undefined
            ? DRAWER_WIDTH_CLASS[
                resolveDrawerWidth(
                  withMountedItems(props.content, itemsMounted),
                  props.width,
                )
              ]
            : 'md:w-(--drawer-panel-width)',
        )}
      >
        {phone ? null : close('floating')}
        <DrawerColumns main={main} aside={aside?.content} testId={testId} />
        {guardDialog}
      </SheetContent>
    </Sheet>
  );
}
