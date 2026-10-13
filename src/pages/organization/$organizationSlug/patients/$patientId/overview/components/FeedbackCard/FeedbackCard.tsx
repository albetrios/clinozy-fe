import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { revealInScroller } from '@/lib/reveal-in-scroller.ts';
import { cn } from '@/lib/utils.ts';
import type { FeedbackActionKind } from '@/shared/api/app/app-schema.ts';
import {
  FEEDBACK_PAGE_SIZE,
  type FeedbackItem,
  type FeedbackType,
} from '@/shared/api/app/feedback-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { usePersonAppointments } from '@/shared/hooks/useAppointments/index.ts';
import {
  useDeleteFeedback,
  useLogFeedbackAction,
  usePatientFeedback,
  useRestoreFeedback,
} from '@/shared/hooks/useFeedback/index.ts';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
} from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { feedbackCountsText } from '../../../shared/patient-feedback.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  CLINICAL_NS,
  FEEDBACK_KEYS,
  OVERVIEW_TEST_IDS,
} from '../../overview.constants.ts';
import {
  canLogFeedback,
  type FeedbackAccess,
  feedbackItemAccess,
} from './feedback-access.ts';
import { useFeedbackCarousel } from './feedback-carousel.ts';
import {
  FEEDBACK_TYPE_LOOK,
  feedbackCardView,
  feedbackTypeLabel,
  feedbackTypeOf,
  feedbackTypesOf,
  type FeedbackVisit,
} from './feedback-view.ts';
import { FeedbackItemCard } from './FeedbackItemCard.tsx';

const K = FEEDBACK_KEYS;
const ID = OVERVIEW_TEST_IDS.feedback;

/** No cards yet — one value, so the visits' lookup is not rebuilt on every render. */
const NO_ITEMS: readonly FeedbackItem[] = [];

/** A round ‹ or › at the carousel's edge (H:4389): 36px, over the cards, mirrored under RTL. */
function CarouselArrow({
  side,
  label,
  onClick,
  testId,
}: {
  side: 'start' | 'end';
  label: string;
  onClick: () => void;
  testId: string;
}) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-slot="floating-edge"
      data-testid={testId}
      className={cn(
        'bg-card text-foreground hover:bg-muted absolute top-1/2 z-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-(--elevation-control)',
        side === 'start' ? 'start-1.5' : 'end-1.5',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 rtl:-scale-x-100" />
    </button>
  );
}

/** Props of {@link FeedbackCard}. */
export interface FeedbackCardProps {
  patientId: string;
  /** What the member may do: check-ins by `patient:update`, reviews by their own codes (D83). */
  access: FeedbackAccess;
  /** "Log feedback ⌄" and the empty tile — the Log feedback picker. */
  onLog: () => void;
  /** A card's Edit — its drawer over the file. */
  onEdit: (item: FeedbackItem) => void;
}

/**
 * "Remove this check-in?" / "Remove this review?" with the delete reasons (`DELETE` with the
 * one picked) and Undo (`POST …/restore`; D32).
 */
function RemoveConfirm({
  patientId,
  item,
  visitOf,
  onClose,
}: {
  patientId: string;
  item: FeedbackItem | null;
  visitOf: (appointmentId: string | null) => FeedbackVisit | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(CLINICAL_NS);
  const remove = useDeleteFeedback();
  const restore = useRestoreFeedback();
  if (!item) return null;
  const view = feedbackCardView(item, t, visitOf);
  const isCheckIn = item.kind === 'checkIn';
  const record = { patientId, kind: item.kind, id: item.id };
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(isCheckIn ? K.removeCheckIn : K.removeReview)}
      confirmLabel={t(K.remove)}
      reason={{
        record: `${view.typeLabel} · ${view.sub}`,
        undo: {
          message: t(isCheckIn ? K.checkInRemoved : K.reviewRemoved),
          onUndo: () => restore.mutate(record),
        },
      }}
      onConfirm={async ({ reason, note }) => {
        await remove.mutateAsync({ ...record, reason, note });
        onClose();
      }}
    />
  );
}

/** The type chips (H:4390): "All", then each type this patient has, each in its tone. */
function TypeChips({
  types,
  value,
  onChange,
}: {
  types: readonly FeedbackType[];
  value: FeedbackType;
  onChange: (type: FeedbackType) => void;
}) {
  const { t } = useTranslation(CLINICAL_NS);
  return (
    <fieldset
      aria-label={t(K.typesLabel)}
      className="m-0 flex min-w-0 flex-wrap gap-1.5 border-b px-3.5 pt-0 pb-3"
    >
      {(['all', ...types] as FeedbackType[]).map((option) => {
        const on = option === value;
        const tone = option === 'all' ? null : FEEDBACK_TYPE_LOOK[option].tone;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option)}
            data-slot="pill"
            data-testid={`${ID}-type-${option}`}
            className={cn(
              'h-6 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-shadow',
              tone ? TONE_CLASSES[tone].surface : 'bg-muted text-foreground',
              // Picked in its own hue's edge and halo ("All" in stone's), not the ink.
              on && TONE_CLASSES[tone ?? 'stone'].selected,
            )}
          >
            {feedbackTypeLabel(option, t)}
          </button>
        );
      })}
    </fieldset>
  );
}

/** What the carousel shows: the cards, and what is left to show. */
interface FeedbackTrackProps {
  items: readonly FeedbackItem[];
  visitOf: (appointmentId: string | null) => FeedbackVisit | null;
  /** No feedback of any type — the dashed "No feedback yet" tile. */
  empty: boolean;
  /** Cards of this type not shown yet — the "Load more" tile shows up to six more. */
  left: number;
  access: FeedbackAccess;
  onLog: () => void;
  onLoadMore: () => void;
  onEdit: (item: FeedbackItem) => void;
  onRemove: (item: FeedbackItem) => void;
  onLogAction: (item: FeedbackItem, action: FeedbackActionKind) => void;
}

/**
 * The sideways carousel (H:4389): 236px cards, three per view — two below
 * 760px of card width — with round ‹ › that scroll 90%, then "Load more".
 */
function FeedbackTrack({
  items,
  visitOf,
  empty,
  left,
  access,
  onLog,
  onLoadMore,
  onEdit,
  onRemove,
  onLogAction,
}: FeedbackTrackProps) {
  const { t } = useTranslation(CLINICAL_NS);
  const { trackRef, onScroll, canPrevious, canNext, previous, next } =
    useFeedbackCarousel();
  return (
    <div className="bg-canvas relative">
      {canPrevious ? (
        <CarouselArrow
          side="start"
          label={t(K.previous)}
          onClick={previous}
          testId={`${ID}-previous`}
        />
      ) : null}
      {canNext ? (
        <CarouselArrow
          side="end"
          label={t(K.next)}
          onClick={next}
          testId={`${ID}-next`}
        />
      ) : null}
      <div
        ref={trackRef}
        onScroll={onScroll}
        // The scroll padding matches the side padding, so the first card snaps
        // at the start and "‹" stays hidden until there is something before it.
        className="grid snap-x snap-mandatory scroll-px-3.5 [scrollbar-width:none] auto-cols-[calc((100%-0.625rem)/2)] grid-flow-col gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth px-3.5 pt-3 pb-3.5 @min-[760px]:auto-cols-[calc((100%-1.25rem)/3)]"
      >
        {empty ? (
          <button
            type="button"
            onClick={canLogFeedback(access) ? onLog : undefined}
            disabled={!canLogFeedback(access)}
            data-testid={`${ID}-empty`}
            className="border-border-strong hover:bg-muted/50 col-span-full flex min-h-30 flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed p-4 text-center"
          >
            <span className="text-body font-semibold">{t(K.emptyTitle)}</span>
            <span className="text-muted-foreground text-xs [text-wrap:pretty]">
              {t(K.emptySub)}
            </span>
          </button>
        ) : null}
        {items.map((item) => (
          <FeedbackItemCard
            key={item.id}
            item={item}
            visitOf={visitOf}
            {...feedbackItemAccess(item, access)}
            onEdit={onEdit}
            onRemove={onRemove}
            onLogAction={onLogAction}
            testId={`${ID}-item`}
          />
        ))}
        {left > 0 ? (
          <button
            type="button"
            onClick={onLoadMore}
            data-slot="card"
            data-testid={`${ID}-load-more`}
            className="border-border-strong bg-card hover:bg-muted text-body text-muted-foreground-strong flex h-59 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed font-medium"
          >
            {t(K.loadMore)}
            <span className="text-caption text-muted-foreground">
              {t(K.more, { count: Math.min(left, FEEDBACK_PAGE_SIZE) })}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The visits the patient's reviews follow, by booking id — one read of the person's bookings
 * (the Visits section's), only once a review names one.
 */
function useFeedbackVisits(items: readonly FeedbackItem[]) {
  const { file } = usePatientFileContext();
  const linked = items.some(
    (item) => item.kind === 'review' && item.review.appointmentId,
  );
  const bookings = usePersonAppointments(linked ? file?.patient.contactId : undefined);
  return useMemo(() => {
    const byId = new Map(
      (bookings.data ?? []).map((booking): [string, FeedbackVisit] => [
        booking.id,
        { seq: booking.seq, service: booking.serviceLabel || null }, // NOSONAR(S6606): a blank service is none
      ]),
    );
    return (appointmentId: string | null) =>
      appointmentId ? (byId.get(appointmentId) ?? null) : null;
  }, [bookings.data]);
}

/** "Feedback unavailable" and Retry — the cards' read failed. */
function FeedbackFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation([CLINICAL_NS, ERRORS_NS]);
  return (
    <div
      role="alert"
      data-testid={`${ID}-error`}
      className="flex flex-col items-center gap-2 px-3.5 pt-3 pb-3.5 text-center"
    >
      <span className="text-muted-foreground text-xs">
        {t(ERRORS_KEYS.widget.unavailable, { ns: ERRORS_NS, title: t(K.title) })}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        {t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS })}
      </Button>
    </div>
  );
}

/** What the open card shows besides the cards' read. */
interface FeedbackBodyProps extends Omit<
  FeedbackTrackProps,
  'items' | 'empty' | 'left' | 'onLoadMore'
> {
  id: string;
  /** Every card, once read. */
  all: readonly FeedbackItem[] | undefined;
  isPending: boolean;
  onRetry: () => void;
}

/**
 * The open card: "Loading…", the failure with Retry, or the type chips ("All" and the
 * types this patient has) over the carousel, six at a time.
 */
function FeedbackBody({ id, all, isPending, onRetry, ...track }: FeedbackBodyProps) {
  const { t } = useTranslation(CLINICAL_NS);
  const [type, setType] = useState<FeedbackType>('all');
  const [limit, setLimit] = useState(FEEDBACK_PAGE_SIZE);
  if (!all) {
    return (
      <div id={id} aria-busy={isPending}>
        {isPending ? (
          <p
            data-testid={`${ID}-loading`}
            className="text-muted-foreground px-3.5 pt-0 pb-3.5 text-xs"
          >
            {t(K.loading)}
          </p>
        ) : (
          <FeedbackFailed onRetry={onRetry} />
        )}
      </div>
    );
  }
  const shown =
    type === 'all' ? all : all.filter((item) => feedbackTypeOf(item) === type);
  const items = shown.slice(0, limit);
  return (
    <div id={id}>
      {all.length > 0 ? (
        <TypeChips
          types={feedbackTypesOf(all)}
          value={type}
          onChange={(next) => {
            setType(next);
            setLimit(FEEDBACK_PAGE_SIZE);
          }}
        />
      ) : null}
      <FeedbackTrack
        {...track}
        items={items}
        empty={all.length === 0}
        left={shown.length - items.length}
        onLoadMore={() => setLimit((value) => value + FEEDBACK_PAGE_SIZE)}
      />
    </div>
  );
}

/** "2 check-ins · 1 review" counted from the cards read. */
function countsOf(items: readonly FeedbackItem[]) {
  const checkIns = items.filter((item) => item.kind === 'checkIn').length;
  return { checkIns, reviews: items.length - checkIns };
}

/**
 * The Feedback card of Clinical notes (KICKOFF §6.6 Feedback; H:807–826):
 * collapsed by default — a 32px tile, "Feedback", "1 check-in · 1 review"
 * (the file's counts until the cards are read), the chevron and "Log feedback
 * ⌄". Open, it reads every check-in and review (`…/check-ins`, `…/reviews`):
 * the type chips ("All" and the types this patient has), then the carousel,
 * six at a time — or the dashed "No feedback yet" tile that opens the picker.
 */
export function FeedbackCard({ patientId, access, onLog, onEdit }: FeedbackCardProps) {
  const { t } = useTranslation(CLINICAL_NS);
  const { file } = usePatientFileContext();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<FeedbackItem | null>(null);
  const feedback = usePatientFeedback(patientId, { enabled: open });
  const logAction = useLogFeedbackAction();
  const bodyId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const visitOf = useFeedbackVisits(feedback.data ?? NO_ITEMS);
  // Open, the cards read count themselves; collapsed, the file's counts (refreshed by every write).
  const counts =
    open && feedback.data
      ? countsOf(feedback.data)
      : { checkIns: file?.feedback.checkIns ?? 0, reviews: file?.feedback.reviews ?? 0 };
  const total = counts.checkIns + counts.reviews;

  const toggle = () => {
    setOpen(!open);
    if (!open) revealInScroller(sectionRef.current);
  };

  const onLogAction = (item: FeedbackItem, action: FeedbackActionKind) => {
    logAction.mutate(
      { patientId, kind: item.kind, id: item.id, action },
      {
        onSuccess: () =>
          notify.success(t(K.actionLogged, { action: t(K.actionKinds[action]) })),
      },
    );
  };

  return (
    <section
      ref={sectionRef}
      aria-label={t(K.title)}
      data-slot="card"
      data-testid={ID}
      className="bg-card @container flex flex-none flex-col overflow-hidden rounded-xl border"
    >
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          data-testid={`${ID}-toggle`}
          className="flex min-w-0 flex-[1_1_15rem] items-center gap-2.5 text-start"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex size-8 flex-none items-center justify-center rounded-lg',
              TONE_CLASSES.sage.surface,
            )}
          >
            <MessageSquare className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
            <span className="text-field font-semibold">{t(K.title)}</span>
            <span className="text-muted-foreground truncate text-xs">
              {total > 0 ? feedbackCountsText(t, counts) : t(K.emptyTitle)}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground size-3.5 flex-none transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
        {canLogFeedback(access) ? (
          <Button
            type="button"
            size="sm"
            onClick={onLog}
            data-testid={`${ID}-log`}
            className="bg-foreground text-background hover:bg-foreground/85 text-detail px-2.5"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            {t(K.log)}
            <ChevronDown aria-hidden="true" className="size-3.5 opacity-70" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <FeedbackBody
          id={bodyId}
          all={feedback.data}
          isPending={feedback.isPending}
          onRetry={() => void feedback.refetch()}
          visitOf={visitOf}
          access={access}
          onLog={onLog}
          onEdit={onEdit}
          onRemove={setRemoving}
          onLogAction={onLogAction}
        />
      ) : null}
      <RemoveConfirm
        patientId={patientId}
        item={removing}
        visitOf={visitOf}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}
