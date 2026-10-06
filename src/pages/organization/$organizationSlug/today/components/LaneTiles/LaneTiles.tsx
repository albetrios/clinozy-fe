import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TODAY_LANES, type TodayLane } from '@/shared/api/clinic/today-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

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
  /** The clinic day, for wording each hint's time. */
  today: string;
  onSelect: (lane: TodayLane) => void;
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
 * The lane tiles (KICKOFF §6.2 Lane tiles; `today.md:19, 31–36`; H:588–597):
 * seven buttons in fixed order, the selected one pressed. From `md` a grid of
 * `auto-fill` 106px tracks — the design's 104 fit its 24-hour hints, but at
 * 1024 they make six 105px tiles a row, too narrow for a 12-hour "since 10:40
 * AM" (82px); 106 makes it five 127px tiles, as the design draws that width.
 * From `lg` the tracks start at 114px, so the widest 12-hour hint ("oldest
 * 12:40 PM", 86px) stays on one line wherever the row lands: at 1280 seven
 * 125px tiles (106 made eight 108px tracks there — 81px for the hint), at
 * 1440 eight 128px tracks. The time itself never breaks (`useClinicClock`
 * keeps it one token). Below `md` one snap strip of 128px tiles that bleeds to
 * the screen edges. Each tile: the label in the lane's ink, the
 * count, up to four faces then "+N", and the hint. Lanes outside the member's
 * focus recede ({@link DIMMED_TILE_INK}); hover inks the border at once (no
 * transition).
 */
export function LaneTiles({ lanes, selected, focus, today, onSelect }: LaneTilesProps) {
  const { t } = useTranslation(TODAY_NS);
  const { formatNumber } = useLocaleFormat();
  const clock = useClinicClock();

  return (
    <div
      role="group"
      aria-label={t(TODAY_KEYS.lanes.label)}
      data-testid={TODAY_TEST_IDS.lanes}
      className="-mx-3 flex flex-none snap-x snap-mandatory scroll-px-3 [scrollbar-width:none] gap-2 overflow-x-auto px-3 pb-0.5 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(106px,1fr))] md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-[repeat(auto-fill,minmax(114px,1fr))] [&::-webkit-scrollbar]:hidden"
    >
      {TODAY_LANES.map((lane) => {
        const cards = lanes[lane];
        const { tone } = TODAY_LANE_META[lane];
        const paint = TONE_CLASSES[tone];
        const tile = LANE_TILE_TONES[tone];
        const pressed = lane === selected;
        const dimmed = !isLaneInFocus(lane, focus);
        const faces = laneFaces(cards);
        const hint = laneHint(lane, cards);
        let border = paint.border;
        if (pressed) border = tile.ink;
        else if (dimmed) border = tile.dimBorder;
        return (
          <button
            key={lane}
            type="button"
            aria-pressed={pressed}
            data-testid={TODAY_TEST_IDS.lane(lane)}
            data-dimmed={dimmed || undefined}
            onClick={() => onSelect(lane)}
            className={cn(
              'text-foreground flex w-32 shrink-0 snap-start flex-col items-start gap-1.5 rounded-lg border-[1.5px] px-3 py-2.5 text-start md:w-auto',
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
            <span
              className={cn(
                'font-heading text-stat leading-none font-semibold tabular-nums',
                dimmed && DIMMED_TILE_INK.count,
              )}
            >
              {formatNumber(cards.length)}
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
        );
      })}
    </div>
  );
}
