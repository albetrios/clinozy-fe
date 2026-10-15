import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { appClockTime } from '@/shared/api/app/app-time.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { CheckCircle, ChevronDown } from '@/shared/icons/index.ts';

import { useCardServiceLine } from '../../hooks/useCardServiceLine/index.ts';
import type { TodayAttentionItem, TodayAttentionTier } from '../../today.attention.ts';
import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from '../../today.constants.ts';
import { TODAY_LANE_META, type TodayCard } from '../../today.lanes.ts';

/** Props for {@link NeedsYouNow}. */
export interface NeedsYouNowProps {
  /** The ranked items (`todayAttention`). */
  items: readonly TodayAttentionItem[];
  /** The first load: two bars stand in. */
  loading?: boolean;
  /** The clock the context lines read. */
  now: Date;
  /** The clinic day the times are on. */
  today: string;
  /** The card's lane action, or null when the member can't take it (hidden, §3.7). */
  actionOf: (card: TodayCard) => (() => void) | null;
  /** The name: their lead, their patient file — as the card's name. */
  onOpen: (card: TodayCard) => void;
  /** The lane chip: open the lane and spotlight the card. */
  onJump: (card: TodayCard) => void;
}

/** How many rows show before "Show n more". */
export const NEEDS_YOU_NOW_VISIBLE = 3;

/** Each tier's tone: hot blush, warm butter, soon sky. */
const TIER_TONES = {
  hot: 'blush',
  warm: 'butter',
  soon: 'sky',
} as const satisfies Record<TodayAttentionTier, string>;

/** A tier's chip dot: a hot one breathes (never under reduced motion). */
const TIER_DOT: Readonly<Record<TodayAttentionTier, string>> = {
  hot: 'animate-[pulse-dot_2400ms_ease-in-out_infinite] motion-reduce:animate-none',
  warm: '',
  soon: '',
};

/** Minutes as an age: "45 min", then whole hours — "2 h". */
const MINUTES_PER_HOUR = 60;

/** The words of an item: its chip ("Late 12 min") and its context ("booked 14:30 · Hydrafacial"). */
function useAttentionWords(now: Date, today: string) {
  const { t } = useTranslation(TODAY_NS);
  const { formatNumber } = useLocaleFormat();
  const formatRupees = useRupeeFormat();
  const clock = useAppClock();
  const service = useCardServiceLine();
  const F = TODAY_KEYS.flags;
  const A = TODAY_KEYS.attention;
  const minutes = (value: number) => ({ minutes: formatNumber(value) });
  /** The clinic-local time an item's clock started — now less its minutes. */
  const startedAt = (item: TodayAttentionItem) =>
    clock.wallTime(today, appClockTime(new Date(now.getTime() - item.minutes * 60_000)));

  const chip = (item: TodayAttentionItem): string => {
    switch (item.kind) {
      case 'late':
        return t(F.late, minutes(item.minutes));
      case 'due':
        return item.minutes === 0 ? t(F.dueNow) : t(F.dueIn, minutes(item.minutes));
      case 'waiting':
        return t(F.waiting, minutes(item.minutes));
      case 'inRoom':
        return t(F.inRoom, minutes(item.minutes));
      case 'checkout':
        return item.rupees === null
          ? t(A.atCheckout)
          : t(F.toPay, { amount: formatRupees(item.rupees) });
      case 'rx':
        return t(A.rxReady);
      case 'reply': {
        const age =
          item.minutes < MINUTES_PER_HOUR
            ? t(A.age.minutes, minutes(item.minutes))
            : t(A.age.hours, {
                hours: formatNumber(Math.floor(item.minutes / MINUTES_PER_HOUR)),
              });
        return t(A.noReply, { age });
      }
    }
  };

  const context = (item: TodayAttentionItem): string => {
    const time = clock.wallTime(today, item.card.time);
    let when: string;
    switch (item.kind) {
      case 'late':
      case 'due':
        when = t(A.context.booked, { time });
        break;
      case 'reply':
        when = t(A.context.heard, { time });
        break;
      case 'rx':
        when = t(A.context.approved, { time: startedAt(item) });
        break;
      default:
        when = t(A.context.since, { time: startedAt(item) });
    }
    const line = service(item.card);
    return line ? `${when} · ${line}` : when;
  };

  return { chip, context };
}

/** One ranked row: the urgency chip, the person and their lane, the context, the lane's action. */
function AttentionRow({
  item,
  words,
  action,
  onOpen,
  onJump,
}: {
  item: TodayAttentionItem;
  words: ReturnType<typeof useAttentionWords>;
  action: (() => void) | null;
  onOpen: (card: TodayCard) => void;
  onJump: (card: TodayCard) => void;
}) {
  const { t } = useTranslation(TODAY_NS);
  const { card } = item;
  const meta = TODAY_LANE_META[card.lane];
  const lanePaint = TONE_CLASSES[meta.tone];
  const tierPaint = TONE_CLASSES[TIER_TONES[item.tier]];
  const laneName = t(TODAY_KEYS.lanes.names[card.lane]);
  const actionWord = meta.action ? t(TODAY_KEYS.actions[meta.action]) : null;
  return (
    <li
      data-testid={TODAY_TEST_IDS.attentionRow}
      data-card-id={card.id}
      data-kind={item.kind}
      data-tier={item.tier}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3.5 py-2 [grid-template-areas:'chip_action'_'body_body'] md:grid-cols-[9.5rem_minmax(0,1fr)_auto] md:[grid-template-areas:'chip_body_action']"
    >
      <span
        data-slot="pill"
        className={cn(
          'text-micro inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 leading-[normal] font-medium tabular-nums [grid-area:chip]',
          tierPaint.surface,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 flex-none rounded-full',
            tierPaint.dot,
            TIER_DOT[item.tier],
          )}
        />
        {words.chip(item)}
      </span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 [grid-area:body]">
        <button
          type="button"
          data-testid={TODAY_TEST_IDS.attentionOpen}
          onClick={() => onOpen(card)}
          className="text-field rounded-sm leading-[normal] font-medium hover:underline"
        >
          {card.name}
        </button>
        <button
          type="button"
          data-slot="pill"
          data-testid={TODAY_TEST_IDS.attentionJump}
          aria-label={t(TODAY_KEYS.attention.jump, { name: card.name, lane: laneName })}
          onClick={() => onJump(card)}
          className={cn(
            'text-micro rounded-full border px-1.75 py-px leading-[normal]',
            lanePaint.surface,
            lanePaint.border,
          )}
        >
          {laneName}
        </button>
        <span className="text-caption text-muted-foreground-strong min-w-0 leading-[normal] tabular-nums">
          {words.context(item)}
        </span>
      </span>
      {action && actionWord ? (
        <button
          type="button"
          data-testid={TODAY_TEST_IDS.attentionAction}
          data-action={meta.action}
          aria-label={`${actionWord}, ${card.name}`}
          onClick={action}
          className={cn(
            'text-detail h-7 rounded-lg border px-3 leading-[normal] font-medium whitespace-nowrap [grid-area:action]',
            lanePaint.bg,
            lanePaint.ink,
            lanePaint.border,
          )}
        >
          {actionWord}
        </button>
      ) : null}
    </li>
  );
}

/** The section's count, in the tone of its most urgent item. */
function AttentionCount({ items }: { items: readonly TodayAttentionItem[] }) {
  const { formatNumber } = useLocaleFormat();
  const [first] = items;
  if (!first) return null;
  return (
    <span
      data-slot="pill"
      className={cn(
        'text-micro rounded-full px-1.75 py-px leading-[normal] font-semibold tabular-nums',
        TONE_CLASSES[TIER_TONES[first.tier]].surface,
      )}
    >
      {formatNumber(items.length)}
    </span>
  );
}

/**
 * Needs you now (change-today-command-center, BRIEF.md change 1): the people on the floor who
 * need someone now, most urgent first — the urgency chip (blush hot, butter warm, sky soon),
 * the name (opens them, as a card's does), the lane chip (spotlights their card on the floor),
 * the context and the lane's own action. Three rows, then "Show n more"; nothing urgent — one
 * calm line. An ordered list: the order is the ranking.
 */
export function NeedsYouNow({
  items,
  loading = false,
  now,
  today,
  actionOf,
  onOpen,
  onJump,
}: NeedsYouNowProps) {
  const { t } = useTranslation(TODAY_NS);
  const { formatNumber } = useLocaleFormat();
  const headingId = useId();
  const listId = useId();
  const words = useAttentionWords(now, today);
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, items.length - NEEDS_YOU_NOW_VISIBLE);
  const shown = expanded ? items : items.slice(0, NEEDS_YOU_NOW_VISIBLE);

  let body: ReactNode;
  if (loading) {
    body = (
      <div aria-hidden="true" className="flex flex-col gap-2.5 px-3.5 py-3">
        <SkeletonBar className="h-4 w-3/4" />
        <SkeletonBar className="h-4 w-2/3" />
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <p
        data-testid={TODAY_TEST_IDS.attentionCalm}
        className="text-body text-muted-foreground-strong flex items-center gap-2 px-3.5 py-2.5"
      >
        <CheckCircle
          aria-hidden="true"
          className="text-tone-sage-foreground size-4 flex-none"
        />
        {t(TODAY_KEYS.attention.calm)}
      </p>
    );
  } else {
    body = (
      <>
        <ol id={listId} className="divide-border flex flex-col divide-y">
          {shown.map((item) => (
            <AttentionRow
              key={item.card.id}
              item={item}
              words={words}
              action={actionOf(item.card)}
              onOpen={onOpen}
              onJump={onJump}
            />
          ))}
        </ol>
        {hidden > 0 ? (
          <button
            type="button"
            data-testid={TODAY_TEST_IDS.attentionMore}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((open) => !open)}
            className="text-detail text-muted-foreground-strong hover:text-foreground flex w-full items-center justify-center gap-1 border-t px-3.5 py-1.5"
          >
            {expanded
              ? t(TODAY_KEYS.attention.less)
              : t(TODAY_KEYS.attention.more, { more: formatNumber(hidden) })}
            <ChevronDown
              aria-hidden="true"
              className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        ) : null}
      </>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      data-testid={TODAY_TEST_IDS.attention}
      className="bg-background flex flex-none flex-col overflow-hidden rounded-lg border shadow-(--elevation-control)"
    >
      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
        <h2
          id={headingId}
          className="font-heading text-sm leading-[normal] font-semibold tracking-[-0.02em]"
        >
          {t(TODAY_KEYS.attention.title)}
        </h2>
        {loading ? null : <AttentionCount items={items} />}
      </div>
      {body}
    </section>
  );
}
