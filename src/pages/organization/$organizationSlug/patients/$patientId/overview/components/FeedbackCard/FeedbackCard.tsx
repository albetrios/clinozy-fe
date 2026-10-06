import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { revealInScroller } from '@/lib/reveal-in-scroller.ts';
import { cn } from '@/lib/utils.ts';
import type { FeedbackActionKind } from '@/shared/api/clinic/clinic-schema.ts';
import {
  FEEDBACK_PAGE_SIZE,
  type FeedbackItem,
  type FeedbackType,
} from '@/shared/api/clinic/feedback-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  useDeleteCheckIn,
  useDeleteReview,
  useLogFeedbackAction,
  usePatientFeedback,
  useRestoreCheckIn,
  useRestoreReview,
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
import {
  CLINICAL_NS,
  FEEDBACK_KEYS,
  OVERVIEW_TEST_IDS,
} from '../../overview.constants.ts';
import { useFeedbackCarousel } from './feedback-carousel.ts';
import {
  FEEDBACK_TYPE_LOOK,
  feedbackCardView,
  feedbackTypeLabel,
} from './feedback-view.ts';
import { FeedbackItemCard } from './FeedbackItemCard.tsx';

const K = FEEDBACK_KEYS;
const ID = OVERVIEW_TEST_IDS.feedback;

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
  /** Patients edit: log, edit, remove and the follow-ups. */
  canEdit: boolean;
  /** "Log feedback ⌄" and the empty tile — the Log feedback picker. */
  onLog: () => void;
  /** A card's Edit — its drawer over the file. */
  onEdit: (item: FeedbackItem) => void;
}

/** "Remove this check-in?" / "Remove this review?" with the delete reasons and Undo (D32). */
function RemoveConfirm({
  item,
  onClose,
}: {
  item: FeedbackItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(CLINICAL_NS);
  const removeCheckIn = useDeleteCheckIn();
  const removeReview = useDeleteReview();
  const restoreCheckIn = useRestoreCheckIn();
  const restoreReview = useRestoreReview();
  if (!item) return null;
  const view = feedbackCardView(item, t);
  const isCheckIn = item.kind === 'checkIn';
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
          onUndo: () =>
            isCheckIn ? restoreCheckIn.mutate(item.id) : restoreReview.mutate(item.id),
        },
      }}
      onConfirm={async ({ reason, note }) => {
        const vars = { id: item.id, reason, note };
        await (isCheckIn
          ? removeCheckIn.mutateAsync(vars)
          : removeReview.mutateAsync(vars));
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
    <div
      role="group"
      aria-label={t(K.typesLabel)}
      className="flex flex-wrap gap-1.5 border-b px-3.5 pb-3"
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
              on && (tone ? TONE_CLASSES[tone].ring : 'ring-foreground ring-1'),
              on && 'ring-[1.5px]',
            )}
          >
            {feedbackTypeLabel(option, t)}
          </button>
        );
      })}
    </div>
  );
}

/** What the carousel shows: the cards, and what is left to load. */
interface FeedbackTrackProps {
  items: readonly FeedbackItem[];
  /** No feedback of any type — the dashed "No feedback yet" tile. */
  empty: boolean;
  /** Cards of this type not loaded yet — the "Load more" tile reads up to six. */
  left: number;
  loading: boolean;
  canEdit: boolean;
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
  empty,
  left,
  loading,
  canEdit,
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
            onClick={canEdit ? onLog : undefined}
            disabled={!canEdit}
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
            canEdit={canEdit}
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
            disabled={loading}
            data-slot="card"
            data-testid={`${ID}-load-more`}
            className="border-border-strong bg-card hover:bg-muted text-body text-muted-foreground-strong flex h-59 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed font-medium"
          >
            {loading ? t(K.loading) : t(K.loadMore)}
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
 * The Feedback card of Clinical notes (KICKOFF §6.6 Feedback; H:807–826;
 * `listFeedback`, `S:1636`): collapsed by default — a 32px tile, "Feedback",
 * "1 check-in · 1 review", the chevron and "Log feedback ⌄". Open: the type
 * chips ("All" and the types this patient has), then the carousel — or the
 * dashed "No feedback yet" tile that opens the picker.
 */
export function FeedbackCard({ patientId, canEdit, onLog, onEdit }: FeedbackCardProps) {
  const { t } = useTranslation(CLINICAL_NS);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('all');
  const [limit, setLimit] = useState(FEEDBACK_PAGE_SIZE);
  const [removing, setRemoving] = useState<FeedbackItem | null>(null);
  const page = usePatientFeedback(patientId, { type, limit });
  const logAction = useLogFeedbackAction();
  const bodyId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const items = page.data?.items ?? [];
  const counts = page.data?.counts ?? { checkIns: 0, reviews: 0 };
  const total = counts.checkIns + counts.reviews;

  const toggle = () => {
    setOpen(!open);
    if (!open) revealInScroller(sectionRef.current);
  };

  const onLogAction = (item: FeedbackItem, action: FeedbackActionKind) => {
    logAction.mutate(
      {
        checkInId: item.kind === 'checkIn' ? item.id : null,
        reviewId: item.kind === 'review' ? item.id : null,
        action,
        note: null,
      },
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
        {canEdit ? (
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
        <div id={bodyId}>
          {total > 0 ? (
            <TypeChips
              types={page.data?.types ?? []}
              value={type}
              onChange={(next) => {
                setType(next);
                setLimit(FEEDBACK_PAGE_SIZE);
              }}
            />
          ) : null}
          <FeedbackTrack
            items={items}
            empty={total === 0}
            left={(page.data?.total ?? 0) - items.length}
            loading={page.isFetching}
            canEdit={canEdit}
            onLog={onLog}
            onLoadMore={() => setLimit((value) => value + FEEDBACK_PAGE_SIZE)}
            onEdit={onEdit}
            onRemove={setRemoving}
            onLogAction={onLogAction}
          />
        </div>
      ) : null}
      <RemoveConfirm item={removing} onClose={() => setRemoving(null)} />
    </section>
  );
}
