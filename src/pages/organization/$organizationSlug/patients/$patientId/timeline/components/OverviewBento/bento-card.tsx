import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { PatientFileSectionSlug } from '@/shared/app/patient-file-sections.ts';
import { type PillTone, TonePill } from '@/shared/components/Cells/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { type AppIcon, ChevronRight, Plus } from '@/shared/icons/index.ts';

import {
  PATIENT_FILE_SECTION_ICONS,
  PATIENT_FILE_SECTION_TONES,
} from '../../../shared/patient-file-nav.ts';
import {
  OVERVIEW_CARD_TONES,
  type OverviewCard,
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import type { BentoRead } from './bento-read.ts';

/** A card's 28px ghost square: its "New …" plus and its "Open <Card>" chevron. */
function SquareButton({
  label,
  icon: Icon,
  onClick,
  testId,
}: {
  label: string;
  icon: AppIcon;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className="text-muted-foreground-strong hover:bg-muted hover:text-foreground"
    >
      <Icon aria-hidden="true" className="size-3.5 rtl:-scale-x-100" />
    </Button>
  );
}

/** A card's outline 28px action: "Book", "Reschedule", "Upload". */
export function BentoButton({
  onClick,
  testId,
  children,
}: {
  onClick: () => void;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={onClick}
      data-testid={testId}
      className="bg-card hover:bg-muted text-foreground text-xs shadow-none"
    >
      {children}
    </Button>
  );
}

/** Props of {@link BentoCard}. */
interface BentoCardProps {
  card: OverviewCard;
  title: string;
  icon: AppIcon;
  /** The count beside the title; none for none. */
  count?: number;
  /** The head's own actions, before "New …" and "Open". */
  actions?: ReactNode;
  /** "New prescription" … — the head's plus, for a member who may add one. */
  onNew?: { label: string; run: () => void } | null;
  /** "Open <Card>" — the card's section, for a member who may open it. */
  onOpen?: (() => void) | null;
  /** The card's place in its row (a span). */
  className?: string;
  children: ReactNode;
}

/**
 * One bento card (H:769–779; KICKOFF §6.6 Overview): padding 14, radius 12, a
 * 1px divider; the head — the 28px tone tile with its icon, the title, the
 * count, the card's actions, "New …" and "Open <Card>" — over its content.
 * It fills its cell (change-patient-overview-photos D9): every card in a row
 * is one height, and its content column grows so an empty slot takes the rest.
 */
export function BentoCard({
  card,
  title,
  icon: Icon,
  count,
  actions,
  onNew,
  onOpen,
  className,
  children,
}: BentoCardProps) {
  const { t } = useTranslation(TIMELINE_NS);
  const testId = TIMELINE_TEST_IDS.card(card);
  return (
    <section
      data-slot="card"
      data-testid={testId}
      aria-label={title}
      className={cn(
        'bg-card flex h-full min-w-0 flex-col gap-3 rounded-xl border p-3.5',
        className,
      )}
    >
      <div className="flex min-h-7 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-lg',
            TONE_CLASSES[OVERVIEW_CARD_TONES[card]].surface,
          )}
        >
          <Icon className="size-3.75" />
        </span>
        <h3 className="text-field font-semibold whitespace-nowrap">{title}</h3>
        {count ? (
          <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
        ) : null}
        <span className="flex-1" />
        {actions}
        {onNew ? (
          <SquareButton
            label={onNew.label}
            icon={Plus}
            onClick={onNew.run}
            testId={`${testId}-new`}
          />
        ) : null}
        {onOpen ? (
          <SquareButton
            label={t(TIMELINE_KEYS.open, { card: title })}
            icon={ChevronRight}
            onClick={onOpen}
            testId={`${testId}-open`}
          />
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

/** One row of a card's list (H:771): a title over its sub line, an optional tag. */
export function BentoRow({
  title,
  sub,
  tag,
  onClick,
  testId,
}: {
  title: string;
  sub: string;
  tag?: { label: string; tone: PillTone } | null;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="hover:bg-canvas -mx-2 flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-body truncate font-medium">{title}</span>
        <span className="text-muted-foreground truncate text-xs">{sub}</span>
      </span>
      {tag ? (
        <TonePill tone={tag.tone} size="sm" className="flex-none">
          {tag.label}
        </TonePill>
      ) : null}
    </button>
  );
}

/** A card's add, offered in its empty slot: "Book", "New prescription", the photo picker. */
export interface BentoEmptyAction {
  label: string;
  run: () => void;
}

/**
 * A card's empty state (change-patient-overview-photos D10): a dashed slot in
 * the section's tone filling what the card has left — its 32px tone tile, the
 * empty line and, when the card has its add, that add under it, the whole slot
 * then one button that runs it. No illustration, so a row of empty cards stays
 * calm and the cards with records read first.
 */
function BentoEmpty({
  section,
  title,
  testId,
  action,
}: {
  section: PatientFileSectionSlug;
  title: string;
  testId: string;
  action?: BentoEmptyAction | null;
}) {
  const Icon = PATIENT_FILE_SECTION_ICONS[section];
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 flex-none items-center justify-center rounded-lg',
          TONE_CLASSES[PATIENT_FILE_SECTION_TONES[section]].surface,
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="text-detail text-foreground-soft leading-snug font-medium text-pretty">
        {title}
      </span>
      {action ? (
        <span className="text-foreground inline-flex items-center gap-1 text-xs font-semibold">
          <Plus aria-hidden="true" className="size-3.5" />
          {action.label}
        </span>
      ) : null}
    </>
  );
  const look =
    'border-border-strong flex min-h-24 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center';
  if (!action) {
    return (
      <div data-testid={testId} data-slot="bento-empty" className={look}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={action.run}
      data-testid={testId}
      data-slot="bento-empty"
      className={cn(
        look,
        'hover:bg-canvas hover:border-muted-foreground transition-colors',
      )}
    >
      {body}
    </button>
  );
}

/**
 * A card's read in place while it holds nothing to list: two bars while it loads, its failure
 * with Retry (the card's own, no toast of its own), else its empty line once read.
 */
export function BentoReadState({
  read,
  empty,
  label,
  emptyTitle,
  section,
  testId,
  emptyAction,
}: {
  read: BentoRead;
  /** Nothing to list — the state shows only then. */
  empty: boolean;
  /** What is loading, for screen readers: the card's title. */
  label: string;
  emptyTitle: string;
  /** The patient-file section the card reads — its empty state's tone and glyph. */
  section: PatientFileSectionSlug;
  /** The card's test id — the empty line is `<card>-empty`. */
  testId: string;
  /** The card's add, offered in the empty slot; none for a member who may not. */
  emptyAction?: BentoEmptyAction | null;
}) {
  const { t } = useTranslation(ERRORS_NS);
  if (!empty) return null;
  if (read.isError) {
    return (
      <RetryError
        message={t(ERRORS_KEYS.frontend.query.loadFailed)}
        onRetry={read.retry}
      />
    );
  }
  if (read.isPending) return <SkeletonRows rows={2} label={label} />;
  return read.isSuccess ? (
    <BentoEmpty
      section={section}
      title={emptyTitle}
      testId={`${testId}-empty`}
      action={emptyAction}
    />
  ) : null;
}
