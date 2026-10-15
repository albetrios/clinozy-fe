import { type KeyboardEvent, type Ref, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { TodayLane } from '@/shared/api/app/today-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { RoomSearchField } from '@/shared/components/RoomToolbar/RoomSearchField/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Search } from '@/shared/icons/index.ts';

import { useCardServiceLine } from '../../hooks/useCardServiceLine/index.ts';
import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from '../../today.constants.ts';
import {
  findOnFloor,
  FLOOR_FINDER_LIMIT,
  type FloorFinderMatch,
} from '../../today.finder.ts';
import { TODAY_LANE_META, type TodayCard, type TodayLanes } from '../../today.lanes.ts';

/** Props for {@link FloorFinder}. */
export interface FloorFinderProps {
  lanes: TodayLanes;
  /** The lanes this member can read — no one else is findable. */
  visible: readonly TodayLane[];
  /** The clinic day the times are on. */
  today: string;
  /** Picked: open their lane and spotlight their card. */
  onPick: (card: TodayCard) => void;
  /** No one on the floor by that name — look among every contact (the command menu). */
  onSearchEveryone?: () => void;
  /** The input — the page's "/" focuses it. */
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

/** The longest query — as long as a room's list search. */
const FINDER_QUERY_MAX = 80;

/** A name with the matched part in bold. */
function MatchedName({ match }: { match: FloorFinderMatch }) {
  const { name } = match.card;
  if (!match.range) return <>{name}</>;
  const [start, end] = match.range;
  return (
    <>
      {name.slice(0, start)}
      <mark className="text-foreground bg-transparent font-semibold">
        {name.slice(start, end)}
      </mark>
      {name.slice(end)}
    </>
  );
}

/**
 * One result: the lane's dot, the name (the match in bold) over its service, the lane chip and
 * the time. The field keeps focus (`aria-activedescendant`): a press never moves it here.
 */
function FinderOption({
  id,
  match,
  today,
  selected,
  onHover,
  onPick,
}: {
  id: string;
  match: FloorFinderMatch;
  today: string;
  selected: boolean;
  onHover: () => void;
  onPick: (card: TodayCard) => void;
}) {
  const { t } = useTranslation(TODAY_NS);
  const clock = useAppClock();
  const service = useCardServiceLine();
  const { card } = match;
  const lanePaint = TONE_CLASSES[TODAY_LANE_META[card.lane].tone];
  const line = service(card);
  return (
    <div // NOSONAR(S6819): a combobox's rich result (name, service, lane, time) — a native <option> holds plain text only
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      data-testid={TODAY_TEST_IDS.finderResult}
      data-card-id={card.id}
      // Picking keeps the focus in the field until the page moves it to the card.
      onMouseDown={(event) => {
        event.preventDefault();
        onPick(card);
      }}
      onMouseEnter={onHover}
      className="aria-selected:bg-accent flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.75"
    >
      <span
        aria-hidden="true"
        className={cn('size-2 flex-none rounded-full', lanePaint.dot)}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-field text-foreground-soft truncate leading-[normal]">
          <MatchedName match={match} />
        </span>
        {line ? (
          <span className="text-caption text-muted-foreground-strong truncate leading-[normal]">
            {line}
          </span>
        ) : null}
      </span>
      <span className="flex flex-none flex-col items-end gap-0.5">
        <span
          data-slot="pill"
          className={cn(
            'text-micro rounded-full px-1.75 py-px leading-[normal]',
            lanePaint.surface,
          )}
        >
          {t(TODAY_KEYS.lanes.names[card.lane])}
        </span>
        <span className="text-caption text-muted-foreground-strong leading-[normal] tabular-nums">
          {clock.wallTime(today, card.time)}
        </span>
      </span>
    </div>
  );
}

/**
 * The floor finder (change-today-command-center, BRIEF.md change 3): "Find on the floor" —
 * a combobox over today's floor. Typing lists up to eight people by name or phone (their lane,
 * time and service); ↑ ↓ move, Enter picks (the first by default), Escape closes the list and
 * then clears the field. A pick hands the card to the page — its lane opens and the card is
 * spotlit. With no match it says so and offers every contact (the command menu; Enter too).
 * The field is the rooms' own search field (`RoomSearchField`, D8).
 */
export function FloorFinder({
  lanes,
  visible,
  today,
  onPick,
  onSearchEveryone,
  inputRef,
  className,
}: FloorFinderProps) {
  const { t } = useTranslation(TODAY_NS);
  const { formatNumber } = useLocaleFormat();
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(
    () => findOnFloor({ lanes, visible, query }).slice(0, FLOOR_FINDER_LIMIT),
    [lanes, visible, query],
  );
  const open = focused && !dismissed && query.trim() !== '';
  const highlighted = Math.min(active, Math.max(0, matches.length - 1));

  let announcement = '';
  if (open) {
    announcement =
      matches.length > 0
        ? t(TODAY_KEYS.finder.results, { found: formatNumber(matches.length) })
        : t(TODAY_KEYS.finder.none);
  }

  const reset = () => {
    setQuery('');
    setActive(0);
    setDismissed(false);
  };
  const pick = (card: TodayCard) => {
    reset();
    onPick(card);
  };
  const searchEveryone = () => {
    reset();
    onSearchEveryone?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (matches.length === 0) return;
        event.preventDefault();
        setDismissed(false);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((highlighted + step + matches.length) % matches.length);
        return;
      }
      case 'Enter': {
        if (!open) return;
        event.preventDefault();
        const match = matches[highlighted];
        if (match) pick(match.card);
        else if (onSearchEveryone) searchEveryone();
        return;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          setDismissed(true);
        } else if (query !== '') {
          event.preventDefault();
          reset();
        }
        return;
      default:
    }
  };

  return (
    <div
      data-testid={TODAY_TEST_IDS.finder}
      className={cn('relative w-full md:w-56 lg:w-60 xl:w-72', className)}
    >
      <RoomSearchField
        layout="fill"
        value={query}
        onValueChange={(next) => {
          setQuery(next);
          setActive(0);
          setDismissed(false);
        }}
        placeholder={t(TODAY_KEYS.finder.placeholder)}
        label={t(TODAY_KEYS.finder.label)}
        maxLength={FINDER_QUERY_MAX}
        inputTestId={TODAY_TEST_IDS.finderInput}
        inputRef={inputRef}
        combobox={{
          expanded: open && matches.length > 0,
          controls: listId,
          activeDescendant:
            open && matches.length > 0 ? optionId(highlighted) : undefined,
        }}
        onKeyDown={onKeyDown}
        onFocusChange={setFocused}
        className="md:pe-8"
      />
      {query === '' ? (
        // The "/" that focuses the field — the rooms' search key.
        <span
          aria-hidden="true"
          className="border-border bg-canvas text-micro text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 flex h-4.5 min-w-4.5 -translate-y-1/2 items-center justify-center rounded-sm border px-1 leading-none font-normal max-md:hidden"
        >
          /
        </span>
      ) : null}
      <output className="sr-only">{announcement}</output>
      {open ? (
        // A popover surface: the menu style (translucent, glass) reaches it.
        <div
          data-slot="popover-content"
          className="bg-popover text-popover-foreground animate-dropdown-in absolute end-0 top-full z-30 mt-1 w-full min-w-72 overflow-hidden rounded-lg border shadow-(--elevation-menu) max-md:start-0"
        >
          {matches.length > 0 ? (
            <div // NOSONAR(S6819): the combobox's popup list (focus stays in the field, aria-activedescendant) — a native <select> or <datalist> cannot hold these rows
              id={listId}
              role="listbox"
              aria-label={t(TODAY_KEYS.finder.label)}
              data-testid={TODAY_TEST_IDS.finderResults}
              className="max-h-80 overflow-y-auto p-1"
            >
              {matches.map((match, index) => (
                <FinderOption
                  key={match.card.id}
                  id={optionId(index)}
                  match={match}
                  today={today}
                  selected={index === highlighted}
                  onHover={() => setActive(index)}
                  onPick={pick}
                />
              ))}
            </div>
          ) : (
            <div
              data-testid={TODAY_TEST_IDS.finderNone}
              className="flex flex-col items-start gap-2 px-3 py-2.5"
            >
              <p className="text-detail text-muted-foreground-strong">
                {t(TODAY_KEYS.finder.none)}
              </p>
              {onSearchEveryone ? (
                <button
                  type="button"
                  data-testid={TODAY_TEST_IDS.finderEveryone}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={searchEveryone}
                  className="text-detail hover:bg-accent flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium"
                >
                  <Search aria-hidden="true" className="size-3.5" />
                  {t(TODAY_KEYS.finder.everyone)}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
