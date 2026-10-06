import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { type PillTone, TonePill } from '@/shared/components/Cells/index.ts';
import { type AppIcon, ChevronRight, Plus } from '@/shared/icons/index.ts';

import {
  OVERVIEW_CARD_TONES,
  type OverviewCard,
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';

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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className="text-muted-foreground-strong hover:bg-muted hover:text-foreground flex size-7 flex-none items-center justify-center rounded-lg transition-colors"
    >
      <Icon aria-hidden="true" className="size-3.5 rtl:-scale-x-100" />
    </button>
  );
}

/** A card's outline 28px action: "Book", "Upload", "Use session". */
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
    <button
      type="button"
      onClick={onClick}
      data-slot="button"
      data-testid={testId}
      className="bg-card hover:bg-muted text-foreground h-7 flex-none rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors"
    >
      {children}
    </button>
  );
}

/** Props of {@link BentoCard}. */
interface BentoCardProps {
  card: OverviewCard;
  title: string;
  icon: AppIcon;
  /** The count beside the title; none for none. */
  count?: number;
  /** Two columns wide when the grid has two or more (H:4985 `span2`). */
  wide?: boolean;
  /** The head's own actions, before "New …" and "Open". */
  actions?: ReactNode;
  /** "New prescription" … — the head's plus, for a member who may add one. */
  onNew?: { label: string; run: () => void } | null;
  /** "Open <Card>" — the card's section, for a member who may open it. */
  onOpen?: (() => void) | null;
  children: ReactNode;
}

/**
 * One bento card (H:769–779; KICKOFF §6.6 Overview): padding 14, radius 12, a
 * 1px divider; the head — the 28px tone tile with its icon, the title, the
 * count, the card's actions, "New …" and "Open <Card>" — over its content.
 */
export function BentoCard({
  card,
  title,
  icon: Icon,
  count,
  wide = false,
  actions,
  onNew,
  onOpen,
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
        'bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-3.5',
        wide && '@min-[640px]:col-span-2',
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
      {children}
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
