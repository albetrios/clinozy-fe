import {
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useId,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  CREATED_PRESETS,
  type CreatedPreset,
  FOLLOW_UP_PRESETS,
  type FollowUpPreset,
  toDateRange,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { TONE_CLASSES, toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { PickerSheet } from '@/shared/components/Picker/PickerSheet/index.ts';
import {
  DATE_FILTER_KEYS,
  ROOM_FILTERS_KEYS,
  ROOM_TOOLBAR_NS,
  roomToolbarTestIds,
} from '@/shared/components/RoomToolbar/room-toolbar.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { savedViewName, useSavedViews } from '@/shared/hooks/useSavedViews/index.ts';
import { type AppIcon, ListFilter, X } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  dateRangeEnds,
  isDateRange,
  type RoomDateFilterKind,
  type RoomFilterField,
  type RoomFilterFields,
  type RoomFilterValues,
  setRoomDateFilter,
  toggleRoomFilterOption,
  withDateRangeEnd,
} from './room-filters.ts';
import { useRoomFilters } from './useRoomFilters.ts';

/** How far back and ahead a custom range's pickers reach (H:4459). */
const RANGE_PAST_DAYS = 365;
const RANGE_FUTURE_DAYS = 90;

/** One option chip's copy: its label, its tone (else its label's), an icon. */
export interface RoomFilterOption {
  label: string;
  tone?: Tone;
  icon?: AppIcon;
}

/** An options filter's copy: the section label and each value's chip. */
export interface RoomFilterCopy {
  /** The section label ("Status"; shown uppercase). */
  label: string;
  /** Each value's chip, by value. */
  options: Readonly<Record<string, RoomFilterOption>>;
  /** A single-pick filter's default chip ("All", "Any"), picked while nothing is. */
  anyLabel?: string;
}

/** Props for {@link RoomFilters}. */
export interface RoomFiltersProps {
  /** The room's filters — the same object its `validateSearch` parses with. */
  fields: RoomFilterFields;
  /** Copy for the options filters, by field key (date sections bring their own). */
  copy: Readonly<Record<string, RoomFilterCopy>>;
  /** The table whose saved views "Save as view" adds to; without it there is none. */
  savedViewsTableId?: string;
  /** Test-id prefix — the room's table id. */
  testIdPrefix: string;
  /**
   * The phone row the button sits on: the search row at 40px (the default)
   * or the tabs row at 36px (Leads, H:83–88).
   */
  phoneRow?: 'search' | 'tabs';
  className?: string;
}

/** Props for {@link FilterChip}. */
export interface FilterChipProps {
  label: string;
  tone: Tone;
  icon?: AppIcon;
  pressed: boolean;
  onToggle: () => void;
}

/**
 * One 24px toggle chip in its value's tone: picked = a 1.5px ring in its ink,
 * a 1px one on hover (H:1089) — the Filters popover's chips, and a view bar's.
 */
export function FilterChip({
  label,
  tone,
  icon: Icon,
  pressed,
  onToggle,
}: FilterChipProps) {
  // The ring is drawn on the button in the tone's ink (`ring-current`).
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-slot="pill"
      data-filter-chip=""
      onClick={onToggle}
      className={cn(
        'flex max-w-full flex-none rounded-full ring-current transition-shadow duration-150',
        TONE_CLASSES[tone].ink,
        pressed ? 'ring-[1.5px]' : 'hover:ring-1',
      )}
    >
      <TonePill tone={tone} icon={Icon ? <Icon className="size-3.25" /> : undefined}>
        {label}
      </TonePill>
    </button>
  );
}

/** A section: its 11px uppercase label over a wrapping row of chips. */
function FilterSection({
  label,
  children,
  after,
}: {
  label: string;
  children: ReactNode;
  after?: ReactNode;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <span
        id={labelId}
        className="text-micro text-muted-foreground leading-[1.2] font-semibold tracking-[0.05em] uppercase"
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {after}
    </div>
  );
}

/**
 * Each date section's chips in order — its presets (`clinic-list-filters.ts`)
 * — and their tones, then "Custom range" (H:3859); "Any" is stone.
 */
const DATE_CHIPS = {
  created: {
    presets: CREATED_PRESETS,
    tones: {
      today: 'sage',
      yesterday: 'sky',
      last_7: 'lav',
      last_30: 'butter',
      this_month: 'mint',
    } satisfies Record<CreatedPreset, Tone>,
    range: 'blush',
  },
  followUp: {
    presets: FOLLOW_UP_PRESETS,
    tones: {
      overdue: 'blush',
      today: 'sage',
      tomorrow: 'sky',
      next_7: 'lav',
      not_set: 'butter',
    } satisfies Record<FollowUpPreset, Tone>,
    range: 'mint',
  },
} as const satisfies Record<
  RoomDateFilterKind,
  { presets: readonly string[]; tones: Readonly<Record<string, Tone>>; range: Tone }
>;

/** One end of a custom range: its label, value and the other end bounding it. */
function RangeEnd({
  label,
  name,
  value,
  min,
  max,
  onChange,
  testId,
}: {
  label: string;
  name: string;
  value: string | null;
  min?: string;
  max?: string;
  onChange: (date: string | null) => void;
  testId: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span aria-hidden="true" className="text-caption text-muted-foreground">
        {label}
      </span>
      <DatePicker
        value={value}
        onChange={onChange}
        label={name}
        placeholder={label}
        min={min}
        max={max}
        past={RANGE_PAST_DAYS}
        future={RANGE_FUTURE_DAYS}
        testId={testId}
      />
    </div>
  );
}

/** Props for {@link RoomDateFilter}: the field, its presets and the pending values. */
export interface RoomDateFilterProps {
  /** The URL key the section edits (`created`, `followUp`). */
  fieldKey: string;
  kind: RoomDateFilterKind;
  /** The pending values, `RoomFilterValues` shaped. */
  values: RoomFilterValues;
  onChange: Dispatch<SetStateAction<RoomFilterValues>>;
}

/**
 * A date section: "Any", the presets, "Custom range" — which adds the 32px
 * "From" / "To" date pickers, each bounded by the other and starting today
 * (H:4459). The URL holds a range as `from..to`, either end open. The Filters
 * popover's own sections, and a room popover's that composes these parts.
 */
export function RoomDateFilter({
  fieldKey,
  kind,
  values,
  onChange,
}: RoomDateFilterProps) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  const keys = DATE_FILTER_KEYS[kind];
  const chips = DATE_CHIPS[kind];
  const presetKeys: Readonly<Record<string, string>> = keys.presets;
  const tones: Readonly<Record<string, Tone>> = chips.tones;
  const value = values[fieldKey]?.[0];
  const ends = isDateRange(value) ? dateRangeEnds(value) : null;
  const set = (next: string | undefined) =>
    onChange((pending) => setRoomDateFilter(pending, fieldKey, next));
  const setEnd = (end: 'from' | 'to', date: string | null) =>
    onChange((pending) => {
      const current = pending[fieldKey]?.[0];
      const range = isDateRange(current) ? current : toDateRange(null, null);
      return setRoomDateFilter(pending, fieldKey, withDateRangeEnd(range, end, date));
    });
  const rangeName = (end: string) => `${t(keys.label)} · ${end}`;

  return (
    <FilterSection
      label={t(keys.label)}
      after={
        ends ? (
          <div className="grid grid-cols-2 gap-2">
            <RangeEnd
              label={t(ROOM_FILTERS_KEYS.from)}
              name={rangeName(t(ROOM_FILTERS_KEYS.from))}
              value={ends.from}
              max={ends.to ?? undefined}
              onChange={(date) => setEnd('from', date)}
              testId={`filter-${fieldKey}-from`}
            />
            <RangeEnd
              label={t(ROOM_FILTERS_KEYS.to)}
              name={rangeName(t(ROOM_FILTERS_KEYS.to))}
              value={ends.to}
              min={ends.from ?? undefined}
              onChange={(date) => setEnd('to', date)}
              testId={`filter-${fieldKey}-to`}
            />
          </div>
        ) : null
      }
    >
      <FilterChip
        label={t(ROOM_FILTERS_KEYS.any)}
        tone="stone"
        pressed={value === undefined}
        onToggle={() => set(undefined)}
      />
      {chips.presets.map((preset) => (
        <FilterChip
          key={preset}
          label={t(presetKeys[preset] ?? preset)}
          tone={tones[preset] ?? 'stone'}
          pressed={value === preset}
          onToggle={() => set(preset)}
        />
      ))}
      <FilterChip
        label={t(keys.range)}
        tone={chips.range}
        pressed={ends !== null}
        onToggle={() => {
          // A range starts on today at each end it does not have yet.
          const today = clinicToday();
          set(toDateRange(ends?.from ?? today, ends?.to ?? today));
        }}
      />
    </FilterSection>
  );
}

/**
 * An options filter's section: a chip per value in its tone (else its label's)
 * — any number picked, or one for a `single` filter, whose "All" / "Any" chip
 * (when the copy names one) stands for no pick.
 */
function OptionsSection({
  fieldKey,
  field,
  copy,
  values,
  onChange,
}: {
  fieldKey: string;
  field: Extract<RoomFilterField, { kind: 'options' }>;
  copy: RoomFilterCopy | undefined;
  values: RoomFilterValues;
  onChange: Dispatch<SetStateAction<RoomFilterValues>>;
}) {
  const picked = values[fieldKey] ?? [];
  return (
    <FilterSection label={copy?.label ?? fieldKey}>
      {field.single && copy?.anyLabel ? (
        <FilterChip
          label={copy.anyLabel}
          tone="stone"
          pressed={picked.length === 0}
          onToggle={() =>
            // "All" / "Any" un-picks the one value picked, if any.
            onChange((pending) => {
              const [current] = pending[fieldKey] ?? [];
              return current === undefined
                ? pending
                : toggleRoomFilterOption(pending, fieldKey, current, true);
            })
          }
        />
      ) : null}
      {field.values.map((value) => {
        const option = copy?.options[value];
        const label = option?.label ?? value;
        return (
          <FilterChip
            key={value}
            label={label}
            tone={option?.tone ?? toneForLabel(label)}
            icon={option?.icon}
            pressed={picked.includes(value)}
            onToggle={() =>
              onChange((pending) =>
                toggleRoomFilterOption(pending, fieldKey, value, field.single),
              )
            }
          />
        );
      })}
    </FilterSection>
  );
}

/**
 * The toolbar's Filters (KICKOFF §3.5 Filters popover; H:1089, `_patterns.md:
 * 106–115`): a 36px outline button with a dark count pill and, while filters
 * are on, a joined 30px × "Clear all filters". It opens a 340px popover under
 * the button from `md` and the 82% bottom sheet below it: one section per
 * filter — chips in each value's tone; "Created" / "Follow-up date" presets
 * with a custom range — then "Save as view" and "Apply filter".
 *
 * Choices stay pending in this component until "Apply filter"; Apply, "Clear
 * all" and the joined × write the URL through the room's filter fields, and the
 * list re-fetches from it. Esc or a tap outside closes without applying.
 */
export function RoomFilters({
  fields,
  copy,
  savedViewsTableId,
  testIdPrefix,
  phoneRow = 'search',
  className,
}: RoomFiltersProps) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  const { t: tTable } = useTranslation(TABLE_NS);
  const ids = roomToolbarTestIds(testIdPrefix);
  const { applied, count, apply } = useRoomFilters(fields);
  const savedViews = useSavedViews(savedViewsTableId ?? '');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<RoomFilterValues>({});
  const savedView = count > 0 ? savedViews.find(applied) : undefined;
  const phoneHeight = phoneRow === 'search' ? 'max-md:h-10' : '';

  const onOpenChange = (next: boolean) => {
    if (next) setPending(applied);
    setOpen(next);
  };

  /** A value as its chip reads — what a new view is named after (H:4171). */
  const labelOf = (key: string, value: string): string | null => {
    const field = fields[key];
    if (!field) return null;
    if (field.kind === 'options') return copy[key]?.options[value]?.label ?? value;
    const keys = DATE_FILTER_KEYS[field.presets];
    if (isDateRange(value)) return t(keys.range);
    const presetKeys: Readonly<Record<string, string>> = keys.presets;
    const presetKey = presetKeys[value];
    return presetKey ? t(presetKey) : null;
  };

  const toggleSavedView = () => {
    setOpen(false);
    if (savedView) {
      savedViews.remove(savedView.id);
      notify.success(tTable(TABLE_KEYS.savedViews.removed));
      return;
    }
    const name = savedViewName(
      applied,
      tTable(TABLE_KEYS.savedViews.defaultName),
      labelOf,
    );
    savedViews.save(applied, name);
    notify.success(t(ROOM_FILTERS_KEYS.viewSaved, { name }));
  };

  return (
    <div
      data-slot="room-filters"
      className={cn('flex h-9 flex-none items-stretch', phoneHeight, className)}
    >
      <PickerSheet
        open={open}
        onOpenChange={onOpenChange}
        sheet="filters"
        title={t(ROOM_FILTERS_KEYS.title)}
        align="end"
        testId={ids.filters}
        panelClassName="w-85 max-w-[calc(100vw-2.5rem)] max-h-[min(calc(100vh-10rem),var(--radix-popover-content-available-height))] rounded-xl"
        onOpenAutoFocus={(event) => {
          const panel = event.target instanceof HTMLElement ? event.target : null;
          panel?.querySelector<HTMLElement>('[data-filter-chip]')?.focus();
        }}
        trigger={
          <RoomFiltersTrigger
            count={count}
            open={open}
            data-testid={ids.filtersTrigger}
          />
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-none items-center justify-between gap-3 px-3.5 pt-3">
            <span className="text-field leading-tight font-semibold">
              {t(ROOM_FILTERS_KEYS.title)}
            </span>
            <button
              type="button"
              data-slot="filters-clear-all"
              data-testid={ids.filtersClearAll}
              onClick={() => {
                setPending({});
                apply({});
              }}
              className="text-muted-foreground hover:text-foreground rounded-sm text-xs leading-tight transition-colors"
            >
              {t(ROOM_FILTERS_KEYS.clearAll)}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto px-3.5 pt-3 pb-3.5">
            {Object.entries(fields).map(([key, field]) => {
              if (field.kind === 'date') {
                return (
                  <RoomDateFilter
                    key={key}
                    fieldKey={key}
                    kind={field.presets}
                    values={pending}
                    onChange={setPending}
                  />
                );
              }
              return (
                <OptionsSection
                  key={key}
                  fieldKey={key}
                  field={field}
                  copy={copy[key]}
                  values={pending}
                  onChange={setPending}
                />
              );
            })}
          </div>
          <div className="flex flex-none items-center gap-2 border-t px-3.5 py-2.5">
            {savedViewsTableId && count > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={savedView !== undefined}
                data-testid={ids.filtersSave}
                onClick={toggleSavedView}
                className="text-detail rounded-lg px-2.5 shadow-none"
              >
                {t(savedView ? ROOM_FILTERS_KEYS.savedView : ROOM_FILTERS_KEYS.saveView)}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              data-testid={ids.filtersApply}
              onClick={() => {
                apply(pending);
                setOpen(false);
              }}
              className="text-body ms-auto rounded-lg px-3.5"
            >
              {t(ROOM_FILTERS_KEYS.apply)}
            </Button>
          </div>
        </div>
      </PickerSheet>
      {count > 0 ? (
        <RoomFiltersClear onClear={() => apply({})} testId={ids.filtersClear} />
      ) : null}
    </div>
  );
}

/** Props for {@link RoomFiltersTrigger}: the count and whether the popover is open. */
export interface RoomFiltersTriggerProps extends ComponentProps<'button'> {
  /** How many filters are on — the dark count pill; none at 0. */
  count: number;
  /** The popover is open: its border darkens. */
  open: boolean;
}

/**
 * The Filters button (H:1089, H:1997): `ListFilter` 15px + "Filters" + a dark
 * 18px count pill while filters are on, when it joins the clear × at its
 * inline end. 36px; the toolbar's phone row makes it 40px. Hand it to a
 * `PickerSheet` as its trigger — it takes the open wiring as props.
 */
export function RoomFiltersTrigger({
  count,
  open,
  className,
  ...props
}: RoomFiltersTriggerProps) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  return (
    <button
      type="button"
      // The open wiring a PickerSheet hands it first: its own slot and look win.
      {...props}
      data-slot="filters-trigger"
      className={cn(
        'text-body text-foreground hover:bg-muted flex flex-none items-center gap-1.5 border ps-2.5 pe-3 leading-none font-medium transition-colors duration-120',
        count > 0 ? 'bg-muted border-disabled rounded-s-lg' : 'bg-background rounded-lg',
        open ? 'border-disabled' : count === 0 && 'border-border',
        className,
      )}
    >
      <ListFilter aria-hidden="true" className="text-muted-foreground size-3.75" />
      {t(ROOM_FILTERS_KEYS.title)}
      {count > 0 ? (
        <>
          <span
            aria-hidden="true"
            data-slot="pill"
            className="bg-primary text-primary-foreground text-tiny flex h-4.5 min-w-4.5 flex-none items-center justify-center rounded-full px-1.25 font-semibold tabular-nums"
          >
            {count}
          </span>
          {/* The space keeps "Filters" and the count apart in the accessible name. */}{' '}
          <span className="sr-only">{t(ROOM_FILTERS_KEYS.appliedCount, { count })}</span>
        </>
      ) : null}
    </button>
  );
}

/** The 30px × "Clear all filters" joined to the Filters button while filters are on. */
export function RoomFiltersClear({
  onClear,
  testId,
}: {
  onClear: () => void;
  testId: string;
}) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  return (
    <button
      type="button"
      aria-label={t(ROOM_FILTERS_KEYS.clearAllFilters)}
      title={t(ROOM_FILTERS_KEYS.clearAllFilters)}
      data-slot="filters-clear"
      data-testid={testId}
      onClick={onClear}
      className="bg-muted text-muted-foreground-strong hover:bg-border hover:text-foreground border-disabled flex w-7.5 flex-none items-center justify-center rounded-e-lg border border-s-0 transition-colors duration-120"
    >
      <X aria-hidden="true" className="size-3.75" />
    </button>
  );
}
