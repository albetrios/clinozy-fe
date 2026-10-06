import { Fragment, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  type CivilDayReading,
  civilDayReading,
} from '@/shared/api/clinic/clinic-time.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  shortPersonName,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import {
  type RoomViewTab,
  RoomViewTabs,
} from '@/shared/components/RoomToolbar/RoomTabs/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import {
  type AppIcon,
  Calendar,
  Camera,
  ClipboardList,
  MessageSquare,
  Pill,
  Receipt,
  Sparkles,
  Wallet,
} from '@/shared/icons/index.ts';

import { PhotoThumb } from '../../../shared/components/PhotoThumb/index.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import {
  ACTIVITY_FILTERS,
  ACTIVITY_TONES,
  activityCounts,
  type ActivityFilter,
  type ActivityRow,
  activityRows,
} from './activity-feed.ts';
import { useActivityFeed } from './use-activity-feed.ts';

const K = TIMELINE_KEYS.activity;

/** Each kind's icon (H:4844 `TLI`). */
const ACTIVITY_ICONS: Readonly<Record<ActivityFilter, AppIcon>> = {
  all: ClipboardList,
  visit: Calendar,
  rx: Pill,
  treat: Sparkles,
  inv: Receipt,
  pay: Wallet,
  photo: Camera,
  note: MessageSquare,
};

/** How many of a day's photos a collapsed row shows (H:4860 `slice(0, 4)`). */
const PHOTO_THUMBS = 4;

/** The readings whose name is a word or a weekday, so the date follows it. */
const NAMED_DAYS = new Set<CivilDayReading>([
  'today',
  'yesterday',
  'tomorrow',
  'thisWeek',
]);

/**
 * A day's header (H:4861), named by the rooms' one time rule: "Today",
 * "Yesterday", "Sat" or "Tomorrow" over the date ("3 Oct"); a week back the
 * date alone ("24 Sep"), a day ahead its date ("7 Oct").
 */
function useDayHeading(): (day: string) => { main: string; sub: string | null } {
  const clock = useClinicClock();
  return (day) => ({
    main: clock.day(day),
    sub: NAMED_DAYS.has(civilDayReading(clock.today, day)) ? clock.date(day) : null,
  });
}

/**
 * The filter tabs (H:4864) — the room view tabs' track: each kind's icon and
 * count, "All" spelled out, the open one in its tone's ink; each names itself
 * "<kind> · <count>". In-page views of the list: the arrows move, Enter or
 * Space opens.
 */
function ActivityFilters({
  counts,
  active,
  onSelect,
  controls,
}: {
  counts: Readonly<Record<ActivityFilter, number>>;
  active: ActivityFilter;
  onSelect: (filter: ActivityFilter) => void;
  controls?: string;
}) {
  const { t } = useTranslation(TIMELINE_NS);
  const kinds = ACTIVITY_FILTERS.filter((kind) => kind === 'all' || counts[kind] > 0);
  const tabs: RoomViewTab[] = kinds.map((kind) => {
    const label = t(K.filters[kind]);
    return {
      id: kind,
      label: t(K.filterTitle, { label, count: counts[kind] }),
      // "All" is spelled out; a kind shows its icon. The tab's name says both.
      icon: kind === 'all' ? undefined : ACTIVITY_ICONS[kind],
      iconOnly: true,
      badge: (
        <>
          {kind === 'all' ? <span>{label}</span> : null}
          <span className="tabular-nums">{counts[kind]}</span>
        </>
      ),
      selectedClassName:
        kind === 'all' ? undefined : TONE_CLASSES[ACTIVITY_TONES[kind]].ink,
    };
  });
  return (
    <RoomViewTabs
      label={t(K.filtersLabel)}
      tabs={tabs}
      value={active}
      onValueChange={(next) => {
        const kind = kinds.find((entry) => entry === next);
        if (kind) onSelect(kind);
      }}
      controls={controls}
      testIds={{ list: TIMELINE_TEST_IDS.filters, tab: TIMELINE_TEST_IDS.filter }}
      className="w-auto"
    />
  );
}

/**
 * One row (H:4856–4863): the kind's tile, the title over its sub line — a
 * day's photos as "3 photos" with their thumbnails — the badge, the time and
 * who; it opens its record.
 */
function ActivityRowView({ row }: { row: ActivityRow }) {
  const { t } = useTranslation(TIMELINE_NS);
  const Icon = ACTIVITY_ICONS[row.kind];
  const photos = row.kind === 'photo' && row.entries.length > 1;
  const title = photos ? t(K.photos, { count: row.entries.length }) : row.title;
  const sub = photos
    ? [...new Set(row.entries.map((entry) => entry.sub))].join(', ')
    : row.sub;
  return (
    <button
      type="button"
      onClick={row.open}
      data-testid={TIMELINE_TEST_IDS.activityRow}
      data-kind={row.kind}
      className="hover:bg-canvas -mx-2 flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 flex-none items-center justify-center rounded-lg',
          TONE_CLASSES[ACTIVITY_TONES[row.kind]].surface,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'text-body truncate',
            row.kind === 'note' ? 'text-muted-foreground-strong' : 'font-medium',
          )}
        >
          {title}
        </span>
        {sub ? (
          <span className="text-muted-foreground truncate text-xs">{sub}</span>
        ) : null}
        {photos ? (
          <span className="mt-0.5 flex gap-1">
            {row.entries.slice(0, PHOTO_THUMBS).map((entry) => (
              <span
                key={entry.id}
                className="bg-muted size-8 overflow-hidden rounded-md border"
              >
                <PhotoThumb fileUrl={entry.fileUrl ?? ''} fit="cover" />
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {row.badge ? (
        <TonePill tone={row.badge.tone} size="sm" className="flex-none">
          {row.badge.label}
        </TonePill>
      ) : null}
      {row.time ? (
        <span className="text-muted-foreground flex-none text-xs tabular-nums">
          {row.time}
        </span>
      ) : null}
      {row.by ? (
        <span title={shortPersonName(row.by.name)} className="flex-none">
          <PersonAvatar size="chip" initials={row.by.initials} tone={row.by.tone} />
        </span>
      ) : null}
    </button>
  );
}

/**
 * The Overview's activity timeline (KICKOFF §6.6, D19; H:4840–4864 — a VM
 * with no markup, its layout composed from its fields, AMBER A-F7): a card
 * after the bento — the filter chips with their counts (a chip of none
 * hides), then the patient's records newest first under their days, each
 * opening its record.
 */
export function ActivityTimeline() {
  const { t } = useTranslation(TIMELINE_NS);
  const titleId = useId();
  const listId = useId();
  const heading = useDayHeading();
  const { entries, loading } = useActivityFeed();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const counts = activityCounts(entries);
  // A chip whose records are gone shows everything again.
  const active = counts[filter] > 0 ? filter : 'all';
  const rows = activityRows(entries, active);

  return (
    <section
      data-slot="card"
      data-testid={TIMELINE_TEST_IDS.activity}
      aria-labelledby={titleId}
      className="bg-card mt-3 flex min-w-0 flex-col gap-3 rounded-xl border p-3.5"
    >
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-lg',
            TONE_CLASSES.stone.surface,
          )}
        >
          <ClipboardList className="size-3.75" />
        </span>
        <h3 id={titleId} className="text-field font-semibold">
          {t(K.title)}
        </h3>
        <span className="flex-1" />
        <ActivityFilters
          counts={counts}
          active={active}
          onSelect={setFilter}
          controls={rows.length > 0 ? listId : undefined}
        />
      </div>
      {rows.length > 0 ? (
        <div id={listId} className="flex flex-col">
          {rows.map((row) => {
            const day = row.newDay ? heading(row.day) : null;
            return (
              <Fragment key={row.id}>
                {day ? (
                  <div className="flex items-baseline gap-2 pt-2 pb-1 first:pt-0">
                    <span className="text-xs font-semibold">{day.main}</span>
                    {day.sub ? (
                      <span className="text-muted-foreground text-xs">{day.sub}</span>
                    ) : null}
                  </div>
                ) : null}
                <ActivityRowView row={row} />
              </Fragment>
            );
          })}
        </div>
      ) : null}
      {!loading && entries.length === 0 ? (
        <EmptyState variant="inline" title={t(K.empty)} />
      ) : null}
    </section>
  );
}
