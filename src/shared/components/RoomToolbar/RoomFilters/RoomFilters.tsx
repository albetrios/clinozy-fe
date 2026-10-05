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
import { toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import {
  CountBadge,
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/index.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import {
  type DrawerChipOption,
  DrawerChips,
} from '@/shared/components/DrawerField/drawer-chip-controls.tsx';
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
import {
  type AppIcon,
  Check,
  ChevronDown,
  ListFilter,
  Search,
  X,
} from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  clearRoomFilter,
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

/** The chip values that stand for no pick ("Any", "All") and for a custom range. */
const ANY_CHIP = '__any';
const RANGE_CHIP = '__range';

/** One option chip's copy: its label, its tone (else its label's), an icon. */
export interface RoomFilterOption {
  label: string;
  tone?: Tone;
  icon?: AppIcon;
}

/** One team member a `people` filter lists. */
export interface RoomFilterPerson {
  /** The record id the URL holds. */
  id: string;
  name: string;
  /** Defaults to the name's initials. */
  initials?: string;
  tone: Tone;
  /** Their role, as shown under the name ("Front desk"). */
  role: string;
}

/** A `people` filter's team and words (the Leads "Team", H:1711–1718). */
export interface RoomFilterPeopleCopy {
  members: readonly RoomFilterPerson[];
  /** The picker with nobody picked ("Anyone on the team"). */
  anyone: string;
  /** The picker with two or more picked ("3 people"). */
  count: (count: number) => string;
  /** The list's search field ("Search team"). */
  search: string;
  /** The list when the search matches nobody ("No match"). */
  noMatch: string;
}

/** A filter's copy: the section label, each value's chip, or a people filter's team. */
export interface RoomFilterCopy {
  /** The section label ("Status"; shown uppercase). */
  label: string;
  /** Each value's chip, by value (`{}` for a people filter). */
  options: Readonly<Record<string, RoomFilterOption>>;
  /** A single-pick filter's default chip ("All", "Any"), picked while nothing is. */
  anyLabel?: string;
  /** A "Clear" link at the section label's end while the section has picks. */
  clearLabel?: string;
  /** A `people` filter's team and words. */
  people?: RoomFilterPeopleCopy;
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

/**
 * A section: its 11px uppercase label — with a "Clear" link at its end while
 * the section has picks — over its control. Chips (`DrawerChips`, the app's
 * toggle chips) are handed the label's id and are the section's group; any
 * other control (the people picker) sits in a group the label names.
 */
function FilterSection({
  label,
  children,
  onClear,
  clearLabel,
}: {
  label: string;
  /** The section's control — or its chips, handed the label's id to name their group. */
  children: ReactNode | ((labelId: string) => ReactNode);
  /** The section has picks; its copy names the "Clear" link. */
  onClear?: () => void;
  clearLabel?: string;
}) {
  const labelId = useId();
  const heading = (
    <div className="flex items-center justify-between gap-2">
      <span
        id={labelId}
        className="text-micro text-muted-foreground leading-[1.2] font-semibold tracking-[0.05em] uppercase"
      >
        {label}
      </span>
      {onClear && clearLabel ? (
        <button
          type="button"
          data-slot="filters-section-clear"
          onClick={onClear}
          className="text-caption text-muted-foreground hover:text-foreground rounded-sm leading-tight transition-colors"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
  if (typeof children === 'function') {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        {children(labelId)}
      </div>
    );
  }
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      {heading}
      <div className="flex flex-wrap gap-1.5">{children}</div>
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

  const rangeEnds = ends ? (
    // A full row of its own under the chips: the range's two ends.
    <div className="mt-0.5 grid basis-full grid-cols-2 gap-2">
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
  ) : null;
  const options: DrawerChipOption<string>[] = [
    { value: ANY_CHIP, label: t(ROOM_FILTERS_KEYS.any), tone: 'stone' },
    ...chips.presets.map((preset) => ({
      value: preset,
      label: t(presetKeys[preset] ?? preset),
      tone: tones[preset] ?? 'stone',
    })),
    { value: RANGE_CHIP, label: t(keys.range), tone: chips.range },
  ];
  let picked = value ?? ANY_CHIP;
  if (ends) picked = RANGE_CHIP;

  return (
    <FilterSection label={t(keys.label)}>
      {(labelId) => (
        <DrawerChips
          labelledBy={labelId}
          options={options}
          value={picked}
          onChange={(next) => {
            if (next !== RANGE_CHIP) {
              set(next === ANY_CHIP || next === null ? undefined : next);
              return;
            }
            // A range starts on today at each end it does not have yet.
            const today = clinicToday();
            set(toDateRange(ends?.from ?? today, ends?.to ?? today));
          }}
          trailing={rangeEnds}
        />
      )}
    </FilterSection>
  );
}

/**
 * An options filter's section: a chip per value in its tone (else its label's)
 * — any number picked, or one for a `single` filter, whose "All" / "Any" chip
 * (when the copy names one) stands for no pick; tapping a single filter's pick
 * again clears it.
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
  const options: DrawerChipOption<string>[] = field.values.map((value) => {
    const option = copy?.options[value];
    const label = option?.label ?? value;
    return {
      value,
      label,
      tone: option?.tone ?? toneForLabel(label),
      icon: option?.icon,
    };
  });
  // Each pick is one toggle on the pending values, so quick taps all land.
  const toggle = (value: string) =>
    onChange((pending) => toggleRoomFilterOption(pending, fieldKey, value, field.single));
  const clear = () => onChange((pending) => clearRoomFilter(pending, fieldKey));
  const anyLabel = field.single ? copy?.anyLabel : undefined;

  return (
    <FilterSection
      label={copy?.label ?? fieldKey}
      clearLabel={copy?.clearLabel}
      onClear={picked.length > 0 ? clear : undefined}
    >
      {(labelId) =>
        field.single ? (
          <DrawerChips
            labelledBy={labelId}
            options={
              anyLabel
                ? [{ value: ANY_CHIP, label: anyLabel, tone: 'stone' }, ...options]
                : options
            }
            value={picked[0] ?? (anyLabel ? ANY_CHIP : null)}
            clearable
            onChange={(next) => {
              if (next === null || next === ANY_CHIP) clear();
              else toggle(next);
            }}
          />
        ) : (
          <DrawerChips
            labelledBy={labelId}
            multiple
            ordered
            options={options}
            value={picked}
            onChange={(next) => {
              const toggled =
                next.find((value) => !picked.includes(value)) ??
                picked.find((value) => !next.includes(value));
              if (toggled !== undefined) toggle(toggled);
            }}
          />
        )
      }
    </FilterSection>
  );
}

/** The picker's label: anyone, the one person picked, or how many. */
function peopleLabel(
  copy: RoomFilterPeopleCopy,
  picked: readonly RoomFilterPerson[],
  pickedCount: number,
): string {
  if (pickedCount === 0) return copy.anyone;
  if (pickedCount === 1 && picked[0]) return picked[0].name;
  return copy.count(pickedCount);
}

/** One team member's row: the 28px avatar, name and role, the 24px check box. */
function PersonRow({
  person,
  picked,
  onToggle,
}: {
  person: RoomFilterPerson;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      data-slot="filters-person"
      onClick={onToggle}
      className={cn(
        'text-foreground hover:bg-muted grid grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 rounded-lg px-1.5 py-1.25 text-start transition-colors duration-120',
        picked && 'bg-canvas',
      )}
    >
      <PersonAvatar
        size="list"
        initials={person.initials ?? personInitials(person.name)}
        tone={person.tone}
        selected={picked}
      />
      <span className="flex min-w-0 flex-col leading-[1.25]">
        <span className="text-body truncate font-medium">{person.name}</span>
        {/* The space keeps the name and the role apart in the accessible name. */}{' '}
        <span className="text-micro text-muted-foreground truncate">{person.role}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-6 items-center justify-center rounded-md border',
          picked
            ? 'bg-primary border-primary text-primary-foreground'
            : 'bg-background border-border-strong',
        )}
      >
        {picked ? <Check className="size-3" /> : null}
      </span>
    </button>
  );
}

/**
 * A people section (the Leads "Team · assigned or involved", H:1711–1718): a
 * 36px picker — the picked people's 18px avatars and "Anyone on the team",
 * the one name or "<n> people" — that expands an inline list: a "Search team"
 * field, then each member with a 24px check box, "No match" when the search
 * finds nobody. Any number may be picked; "Clear" empties the section.
 */
function PeopleSection({
  fieldKey,
  copy,
  values,
  onChange,
}: {
  fieldKey: string;
  copy: RoomFilterCopy | undefined;
  values: RoomFilterValues;
  onChange: Dispatch<SetStateAction<RoomFilterValues>>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listId = useId();
  const people = copy?.people;
  if (!(copy && people)) return null;
  const picked = values[fieldKey] ?? [];
  const pickedPeople = people.members.filter((member) => picked.includes(member.id));
  const needle = query.trim().toLowerCase();
  const listed = needle
    ? people.members.filter((member) =>
        `${member.name} ${member.role}`.toLowerCase().includes(needle),
      )
    : people.members;
  const toggle = (id: string) =>
    onChange((pending) => toggleRoomFilterOption(pending, fieldKey, id));

  return (
    <FilterSection
      label={copy.label}
      clearLabel={copy.clearLabel}
      onClear={
        picked.length > 0
          ? () => onChange((pending) => clearRoomFilter(pending, fieldKey))
          : undefined
      }
    >
      <div className="flex w-full min-w-0 flex-col">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          data-slot="filters-people-trigger"
          onClick={() => setOpen((current) => !current)}
          className="bg-background text-body hover:bg-canvas flex h-9 w-full min-w-0 items-center gap-1.5 rounded-lg border ps-1.5 pe-2.5 text-start shadow-(--elevation-control) transition-colors"
        >
          {pickedPeople.length > 0 ? (
            <span className="flex flex-none items-center ps-0.5">
              {pickedPeople.slice(0, 3).map((member) => (
                <PersonAvatar
                  key={member.id}
                  size="line"
                  initials={member.initials ?? personInitials(member.name)}
                  tone={member.tone}
                  className="-me-1.5"
                />
              ))}
            </span>
          ) : null}
          <span
            className={cn(
              'min-w-0 truncate',
              pickedPeople.length > 0
                ? 'text-foreground ms-2'
                : 'text-muted-foreground ms-1',
            )}
          >
            {peopleLabel(people, pickedPeople, picked.length)}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground ms-auto size-3.5 flex-none transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
        {open ? (
          <div
            id={listId}
            data-slot="filters-people-list"
            className="bg-background mt-1.5 flex flex-col overflow-hidden rounded-lg border"
          >
            <div className="text-muted-foreground flex h-8.5 items-center gap-2 border-b px-2.5">
              <Search aria-hidden="true" className="size-3.75 flex-none" />
              <input
                type="search"
                value={query}
                maxLength={80}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={people.search}
                aria-label={people.search}
                className="text-body text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none"
              />
            </div>
            <div className="flex max-h-55 flex-col gap-0.5 overflow-auto p-1">
              {listed.map((member) => (
                <PersonRow
                  key={member.id}
                  person={member}
                  picked={picked.includes(member.id)}
                  onToggle={() => toggle(member.id)}
                />
              ))}
              {listed.length === 0 ? (
                <span className="text-detail text-muted-foreground p-2">
                  {people.noMatch}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
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
    if (field.kind === 'people') {
      return (
        copy[key]?.people?.members.find((member) => member.id === value)?.name ?? null
      );
    }
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
          // The first section's first chip (people rows and buttons are not pills).
          panel
            ?.querySelector<HTMLElement>('button[data-slot="pill"][aria-pressed]')
            ?.focus();
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
              if (field.kind === 'people') {
                return (
                  <PeopleSection
                    key={key}
                    fieldKey={key}
                    copy={copy[key]}
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
          <CountBadge count={count} aria-hidden="true" />
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
