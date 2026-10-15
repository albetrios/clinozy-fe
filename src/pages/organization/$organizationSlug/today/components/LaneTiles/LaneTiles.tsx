import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TODAY_LANES, type TodayLane } from '@/shared/api/app/today-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { ChevronRight, Clock } from '@/shared/icons/index.ts';

import type { TodayLaneAlert } from '../../today.attention.ts';
import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from '../../today.constants.ts';
import {
  isLaneInFocus,
  LANE_TILE_TONES,
  laneFaces,
  laneHint,
  TODAY_LANE_META,
  type TodayLanes,
} from '../../today.lanes.ts';

/** Props for {@link LaneTiles}. */
export interface LaneTilesProps {
  lanes: TodayLanes;
  /** The lane the panel shows (`aria-pressed`). */
  selected: TodayLane;
  /** The member's focus — lanes outside it recede ({@link DIMMED_TILE_INK}). */
  focus: ReadonlySet<TodayLane>;
  /** The lanes this member can read, in their fixed order (`readableTodayLanes`, D163). */
  visible?: readonly TodayLane[];
  /** The clinic day, for wording each hint's time. */
  today: string;
  /** Each lane's alert badge — its people late, waiting long or unanswered (`todayLaneAlerts`). */
  alerts?: Partial<Record<TodayLane, TodayLaneAlert>>;
  onSelect: (lane: TodayLane) => void;
}

/**
 * A tile's alert badge (change-today-command-center): a clock and the number, blush when any
 * of them is hot, butter otherwise. The number is drawn; the words ("Running late: 2") are
 * what the tile's accessible name reads.
 */
function LaneAlertBadge({ alert }: { alert: TodayLaneAlert }) {
  const { t } = useTranslation(TODAY_NS);
  const { formatNumber } = useLocaleFormat();
  const people = formatNumber(alert.count);
  return (
    <span
      data-slot="pill"
      data-testid={TODAY_TEST_IDS.laneAlert}
      data-hot={alert.hot || undefined}
      className={cn(
        'text-micro inline-flex flex-none items-center gap-0.5 rounded-full px-1.5 py-px leading-[normal] font-semibold tabular-nums',
        TONE_CLASSES[alert.hot ? 'blush' : 'butter'].surface,
      )}
    >
      <Clock aria-hidden="true" className="size-2.75" />
      <span aria-hidden="true">{people}</span>
      <span className="sr-only">{t(TODAY_KEYS.alerts[alert.kind], { people })}</span>
    </span>
  );
}

/**
 * A tile's text out of the member's focus. The design dims the whole tile to
 * 60% opacity (`today.md:7`, H:588–597), which took the lane's name to 3.0:1
 * and the hint to 2.5:1 on a light pastel — under WCAG AA. The fill, its border
 * and the faces' ring keep the design's 60% (`LANE_TILE_TONES`); the text
 * recedes a step instead, every pair at least 4.5:1 on the faded fill in both
 * modes: the name and the faces' initials from the lane's ink to
 * muted-foreground-strong, the count to foreground-soft. "+N" and the hint
 * stay on muted-foreground-strong — the next step, muted-foreground, is
 * 4.2–4.3:1 on a faded pastel.
 */
const DIMMED_TILE_INK = {
  label: 'text-muted-foreground-strong',
  count: 'text-foreground-soft',
  face: 'text-muted-foreground-strong',
} as const;

/**
 * The journey strip (KICKOFF §6.2 Lane tiles; `today.md:19, 31–36`; H:588–597;
 * change-today-command-center BRIEF.md change 2): seven buttons in fixed order,
 * the selected one pressed, joined by chevrons — Enquiries › Arriving › … ›
 * Pharmacy, a patient's day read left to right (mirrored under RTL). One row at
 * every width: from `md` the tiles share it, each at least 116px — the widest
 * 12-hour hint ("oldest 12:40 PM", 86px) stays on one line, and the time itself
 * never breaks (`useAppClock` keeps it one token) — and where seven do not fit
 * (a tablet beside the work queue) the row scrolls with snap, as the 128px
 * tiles do below `md`, bleeding to the screen edges. Each tile: the label in the
 * lane's ink, the count with its alert badge ({@link LaneAlertBadge}) at the
 * inline end, up to four faces then "+N", and the hint. Lanes outside the member's focus recede
 * ({@link DIMMED_TILE_INK}); hover inks the border at once (no transition).
 */
export function LaneTiles({
  lanes,
  selected,
  focus,
  visible = TODAY_LANES,
  today,
  alerts = {},
  onSelect,
}: LaneTilesProps) {
  const { t } = useTranslation(TODAY_NS);
  const { formatNumber } = useLocaleFormat();
  const clock = useAppClock();

  return (
    // The group is a fieldset around the strip, not the strip itself: a
    // fieldset scrolls through an anonymous inner box, which the snap and the
    // hidden scrollbar may not reach.
    <fieldset
      aria-label={t(TODAY_KEYS.lanes.label)}
      className="m-0 min-w-0 flex-none border-0 p-0"
    >
      <div
        data-testid={TODAY_TEST_IDS.lanes}
        className="-mx-3 -my-1 flex snap-x snap-mandatory scroll-px-3 [scrollbar-width:none] items-stretch gap-0.5 overflow-x-auto px-3 py-1 md:-mx-1 md:snap-proximity md:scroll-px-1 md:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((lane, index) => {
          const cards = lanes[lane];
          const { tone } = TODAY_LANE_META[lane];
          const paint = TONE_CLASSES[tone];
          const tile = LANE_TILE_TONES[tone];
          const pressed = lane === selected;
          const dimmed = !isLaneInFocus(lane, focus);
          const faces = laneFaces(cards);
          const hint = laneHint(lane, cards);
          let border = paint.border;
          if (pressed) border = tile.pressed;
          else if (dimmed) border = tile.dimBorder;
          const alert = alerts[lane];
          return (
            <Fragment key={lane}>
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-3 flex-none self-center rtl:-scale-x-100"
                />
              ) : null}
              <button
                type="button"
                aria-pressed={pressed}
                data-testid={TODAY_TEST_IDS.lane(lane)}
                data-dimmed={dimmed || undefined}
                onClick={() => onSelect(lane)}
                className={cn(
                  'text-foreground flex w-32 shrink-0 snap-start flex-col items-start gap-1.5 rounded-lg border-[1.5px] px-3 py-2.5 text-start md:w-auto md:min-w-29 md:flex-1',
                  dimmed ? tile.dimFill : paint.bg,
                  border,
                  tile.hover,
                )}
              >
                <span
                  className={cn(
                    'text-xs leading-[normal]',
                    dimmed ? DIMMED_TILE_INK.label : paint.ink,
                  )}
                >
                  {t(TODAY_KEYS.lanes.names[lane])}
                </span>
                <span className="flex w-full items-center justify-between gap-1">
                  <span
                    className={cn(
                      'font-heading text-stat leading-none font-semibold tabular-nums',
                      dimmed && DIMMED_TILE_INK.count,
                    )}
                  >
                    {formatNumber(cards.length)}
                  </span>
                  {alert ? <LaneAlertBadge alert={alert} /> : null}
                </span>
                <span aria-hidden="true" className="flex min-h-5.5 items-center">
                  {faces.faces.map((face) => (
                    <span
                      key={face.id}
                      data-slot="pill"
                      className={cn(
                        'bg-background -me-0.5 box-content flex size-5.5 items-center justify-center rounded-full border-[1.5px] text-[length:calc(var(--text-xs)*19/24)] leading-none',
                        dimmed ? tile.dimFace : tile.face,
                        dimmed ? DIMMED_TILE_INK.face : paint.ink,
                      )}
                    >
                      {face.initials}
                    </span>
                  ))}
                  {faces.more > 0 ? (
                    <span className="text-micro text-muted-foreground-strong ms-2.25 leading-[normal]">
                      {t(TODAY_KEYS.lanes.more, { more: formatNumber(faces.more) })}
                    </span>
                  ) : null}
                </span>
                <span className="text-micro text-muted-foreground-strong leading-[normal] tabular-nums">
                  {hint
                    ? t(TODAY_KEYS.lanes.hints[hint.kind], {
                        time: clock.wallTime(today, hint.time),
                      })
                    : t(TODAY_KEYS.lanes.hints.none)}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </fieldset>
  );
}
