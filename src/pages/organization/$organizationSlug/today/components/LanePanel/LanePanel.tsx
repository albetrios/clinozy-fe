import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { TodayLane } from '@/shared/api/clinic/today-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from '../../today.constants.ts';
import { TODAY_FLAG_TONES, todayCardFlags, type TodayFlag } from '../../today.flags.ts';
import { takeVisitCard } from '../../today.focus.ts';
import { TODAY_LANE_META, type TodayCard } from '../../today.lanes.ts';
import { useCardServiceLine } from './use-card-service-line.ts';

/** Props for {@link LanePanel}. */
export interface LanePanelProps {
  lane: TodayLane;
  cards: readonly TodayCard[];
  /** The first load: three skeleton cards stand in. */
  loading?: boolean;
  /** The clock flags count minutes against. */
  now: Date;
  /** The clinic day the card times are on. */
  today: string;
  /** The card's lane action, or null when the member can't take it (hidden, §3.7). */
  actionOf: (card: TodayCard) => (() => void) | null;
  /** The name and service area: their lead, their patient file, or a toast. */
  onOpen: (card: TodayCard) => void;
}

/** A flag in words. */
function useFlagWords(today: string): (flag: TodayFlag) => string {
  const { t } = useTranslation(TODAY_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const { formatNumber } = useLocaleFormat();
  const money = usePaiseFormat();
  const clock = useClinicClock();
  const K = TODAY_KEYS.flags;
  return (flag) => {
    switch (flag.id) {
      case 'channel':
        return tClinic(CLINIC_KEYS.channels[flag.channel]);
      case 'packLeft':
        return t(K.packLeft, { left: formatNumber(flag.left) });
      case 'due':
        return t(K.due, { amount: money(flag.paise) });
      case 'allergy':
        return t(K.allergy, { name: flag.name });
      case 'waiting':
        return t(K.waiting, { minutes: formatNumber(flag.minutes) });
      case 'inRoom':
        return t(K.inRoom, { minutes: formatNumber(flag.minutes) });
      case 'session':
        return t(K.session, {
          number: formatNumber(flag.number),
          total: formatNumber(flag.total),
        });
      case 'toPay':
        return t(K.toPay, { amount: money(flag.paise) });
      case 'rxApproved':
        return t(K.rxApproved, { time: clock.wallTime(today, flag.time) });
      default:
        return t(K[flag.id]);
    }
  };
}

/**
 * One visit card (KICKOFF §6.2 Visit cards; `today.md:53–59`; H:603–609): the
 * name and time over the service line — one button that opens the person —
 * the flags, and the lane's action across the card's width.
 */
function VisitCard({
  card,
  now,
  today,
  action,
  onOpen,
}: {
  card: TodayCard;
  now: Date;
  today: string;
  action: (() => void) | null;
  onOpen: (card: TodayCard) => void;
}) {
  const { t } = useTranslation(TODAY_NS);
  const clock = useClinicClock();
  const flagWords = useFlagWords(today);
  const service = useCardServiceLine();
  const meta = TODAY_LANE_META[card.lane];
  const paint = TONE_CLASSES[meta.tone];
  const flags = todayCardFlags(card, now);
  const line = service(card);
  return (
    <div
      data-testid={TODAY_TEST_IDS.card}
      data-card-id={card.id}
      className="bg-canvas flex flex-col gap-1.5 rounded-lg border p-2.5"
    >
      <button
        type="button"
        data-testid={TODAY_TEST_IDS.cardOpen}
        onClick={() => onOpen(card)}
        className="flex flex-col gap-0.5 rounded-sm text-start"
      >
        <span className="flex items-baseline justify-between gap-1.5">
          <span className="text-field leading-[normal] font-medium">{card.name}</span>
          <span className="text-caption text-muted-foreground-strong leading-[normal] tabular-nums">
            {clock.wallTime(today, card.time)}
          </span>
        </span>
        {line ? (
          <span className="text-foreground-soft text-xs leading-[normal]">{line}</span>
        ) : null}
      </button>
      {flags.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {flags.map((flag) => (
            <span
              key={flag.id === 'allergy' ? `allergy-${flag.name}` : flag.id}
              data-slot="pill"
              className={cn(
                'text-micro rounded-full px-1.75 py-px leading-[normal]',
                TONE_CLASSES[TODAY_FLAG_TONES[flag.id]].surface,
              )}
            >
              {flagWords(flag)}
            </span>
          ))}
        </span>
      ) : null}
      {action && meta.action ? (
        <button
          type="button"
          data-testid={TODAY_TEST_IDS.cardAction}
          data-action={meta.action}
          onClick={action}
          className={cn(
            'text-detail w-full rounded-lg border px-2 py-1.25 leading-[normal] font-medium',
            paint.bg,
            paint.ink,
            paint.border,
          )}
        >
          {t(TODAY_KEYS.actions[meta.action])}
        </button>
      ) : null}
    </div>
  );
}

/** How many skeleton cards the first load shows (the prototype's placeholder count, H:603). */
const SKELETON_CARDS = ['first', 'second', 'third'] as const;

/** A visit card's shape while the floor first loads — flat bars, no shimmer (§3.5). */
function VisitCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-canvas flex flex-col gap-1.5 rounded-lg border p-2.5"
    >
      <span className="flex items-center justify-between gap-1.5">
        <SkeletonBar className="h-3.5 w-24" />
        <SkeletonBar className="h-3 w-8" />
      </span>
      <SkeletonBar className="h-3 w-32" />
      <SkeletonBar className="h-4 w-16" />
      <SkeletonBar shape="field" className="h-6.75" />
    </div>
  );
}

/**
 * Focus back on the card whose action opened the patient's visit flow (KICKOFF §6.6,
 * §7.2) once the panel shows its cards — its action, else its name; nothing
 * when the card has left this lane.
 */
function useVisitCardFocus(loading: boolean) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (loading) return;
    const cardId = takeVisitCard();
    if (!cardId) return;
    const card = panel.current?.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`);
    const target =
      card?.querySelector<HTMLElement>(`[data-testid="${TODAY_TEST_IDS.cardAction}"]`) ??
      card?.querySelector<HTMLElement>(`[data-testid="${TODAY_TEST_IDS.cardOpen}"]`);
    target?.focus();
  }, [loading]);
  return panel;
}

/**
 * The selected lane's panel (KICKOFF §6.2; `today.md:20, 52–57`; H:599–614): a
 * card in the lane's fill and line — its name and "<n> people", then the
 * visit cards on an `auto-fill` 210px grid (four across at 1440, two at 1024
 * and 820, one on a phone), or "No one here right now.". From `md` it fills
 * the rest of the column and its cards scroll inside; on a phone it grows with
 * its cards and the page scrolls.
 */
export function LanePanel({
  lane,
  cards,
  loading = false,
  now,
  today,
  actionOf,
  onOpen,
}: LanePanelProps) {
  const { t } = useTranslation(TODAY_NS);
  const headingId = useId();
  const panel = useVisitCardFocus(loading);
  const paint = TONE_CLASSES[TODAY_LANE_META[lane].tone];
  return (
    <section
      ref={panel}
      aria-labelledby={headingId}
      data-testid={TODAY_TEST_IDS.panel}
      data-lane={lane}
      className={cn(
        'flex min-h-[150px] flex-col gap-2 rounded-lg border px-3.5 py-3 md:flex-1',
        paint.bg,
        paint.border,
      )}
    >
      <div className="flex items-baseline gap-2.5">
        <h2
          id={headingId}
          className={cn(
            'font-heading text-sm leading-[normal] font-semibold tracking-[-0.02em]',
            paint.ink,
          )}
        >
          {t(TODAY_KEYS.lanes.names[lane])}
        </h2>
        <span className="text-muted-foreground-strong text-xs leading-[normal]">
          {t(TODAY_KEYS.lanes.count, { count: cards.length })}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] content-start gap-2 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {loading
          ? SKELETON_CARDS.map((key) => <VisitCardSkeleton key={key} />)
          : cards.map((card) => (
              <VisitCard
                key={card.id}
                card={card}
                now={now}
                today={today}
                action={actionOf(card)}
                onOpen={onOpen}
              />
            ))}
        {!loading && cards.length === 0 ? (
          <p
            data-testid={TODAY_TEST_IDS.empty}
            className="text-detail text-muted-foreground-strong"
          >
            {t(TODAY_KEYS.lanes.empty)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
