import type { TFunction } from 'i18next';
import type { KeyboardEvent, ReactElement } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';

import {
  PICKER_DEFAULT_TEST_ID,
  PICKER_KEYS,
  PICKER_MAX_CHIPS,
  PICKER_MAX_HEIGHT_CLASSES,
  PICKER_MIN_WIDTH_CLASSES,
  PICKER_NS,
  pickerTestIds,
} from './picker.constants.ts';
import type { PickerOption, PickerProps } from './picker.types.ts';
import { activateItem, itemByValue } from './picker-dom.ts';
import {
  useLoadMoreOnScroll,
  usePickerKnownOptions,
  usePickerRecent,
  usePickerRows,
  usePickerSource,
  usePlainProps,
} from './picker-hooks.ts';
import { handlePickerKey } from './picker-keyboard.ts';
import {
  hasExactLabel,
  isSearchable,
  openingPages,
  type PickerCopy,
  pickerCopy,
  pickerEmptyState,
  type PickerMode,
  pickerMode,
  toggleKey,
  triggerInset,
} from './picker-model.ts';
import type { PickerOptionRow } from './picker-rows.ts';
import { PickerPanel, type PickerPanelAction } from './PickerPanel/index.ts';
import { PickerSheet } from './PickerSheet/index.ts';
import { PickerTrigger, PickerTriggerClear, PickerValue } from './PickerTrigger/index.ts';

/** How the list closed: only a dismissal (outside, Tab) may auto-create. */
type CloseIntent = 'dismiss' | 'escape' | 'pick';

/** The clear × shows on the default trigger while something is picked. */
function clearShown<T>(props: PickerProps<T>, pickedCount: number): boolean {
  return (
    props.clearable === true && !props.renderTrigger && !props.disabled && pickedCount > 0
  );
}

/**
 * Popover width (max(trigger, min width), at most 28rem) and height for the props. The cap keeps
 * a full-width drawer field's list a menu, not a 640px band with each row's details far from its
 * name (change-contact-quick-pick D21).
 */
function panelClassFor<T>(props: PickerProps<T>): string {
  return cn(
    'w-(--radix-popover-trigger-width) max-w-md',
    PICKER_MIN_WIDTH_CLASSES[props.minWidth ?? 240],
    PICKER_MAX_HEIGHT_CLASSES[props.maxHeight ?? 340],
  );
}

/** The field-style trigger with the picks drawn in it. */
function defaultTrigger<T>(
  props: PickerProps<T>,
  view: {
    selected: readonly PickerOption<T>[];
    copy: PickerCopy;
    mode: PickerMode;
    showClear: boolean;
    testId: string;
  },
): ReactElement {
  const size = props.size ?? 'md';
  const multiple = view.mode === 'multiple';
  const avatar = !multiple && view.selected[0]?.leading?.kind === 'avatar';
  return (
    <PickerTrigger
      id={props.id}
      size={size}
      inset={triggerInset(size, avatar)}
      wrap={multiple}
      reserveClear={view.showClear}
      disabled={props.disabled}
      aria-invalid={props.invalid ? true : undefined}
      aria-describedby={props['aria-describedby']}
      aria-label={view.copy.triggerLabel}
      title={view.copy.triggerLabel}
      data-testid={view.testId}
    >
      <PickerValue
        selected={view.selected}
        multiple={multiple}
        size={size}
        placeholder={view.copy.placeholder}
        maxChips={props.maxChips ?? PICKER_MAX_CHIPS}
      />
    </PickerTrigger>
  );
}

/** The create row and the "full details" footer, when the props offer them. */
function createActions<T>(
  t: TFunction,
  props: PickerProps<T>,
  state: { typed: string; exact: boolean; loading: boolean; fullLabel: string },
  run: { create: (typed: string) => void; createFull: (typed: string) => void },
): { create?: PickerPanelAction; createFull?: PickerPanelAction } {
  const { typed, exact, loading, fullLabel } = state;
  const offered = typed !== '' && !exact;
  const create =
    props.onCreate && offered && !loading
      ? {
          label: props.createLabel
            ? t(PICKER_KEYS.createNamed, { label: props.createLabel, query: typed })
            : t(PICKER_KEYS.create, { query: typed }),
          onSelect: () => run.create(typed),
        }
      : undefined;
  const createFull =
    props.onCreateFull && !props.menu
      ? {
          label: offered
            ? t(PICKER_KEYS.createFullQuery, { label: fullLabel, query: typed })
            : fullLabel,
          onSelect: () => run.createFull(typed),
        }
      : undefined;
  return { create, createFull };
}

/**
 * The one picker (KICKOFF §3.5, H:3909–3976, `_patterns.md:77–90`): a trigger
 * that opens a `popover` + `command` list from `md` up and the 72% dimmed
 * bottom sheet below it. Static `options` are searched locally (label, sub,
 * meta, group, keywords; label-prefix matches first, the hit highlighted);
 * `loadOptions` pages remote options 30 at a time with a 300ms debounced
 * server search. Single-select lists of more than 7 options with a
 * `recentKey` open on "Recent" (the last 3 picks, kept on the user's
 * preferences) then "All". `onCreate` adds a "Create “<query>”" row and
 * `onCreateFull` the "full details" footer; `autoCreate` creates when the list
 * is dismissed on an unmatched search.
 *
 * Keys: ↑ ↓ (skipping disabled rows, wrapping), PgUp / PgDn ±8, Home / End, ↵
 * picks (or creates), Esc closes and returns focus to the trigger, Tab closes,
 * and type-ahead when there is no search row. A single pick closes the list;
 * a multi-select stays open. `plain` draws a neutral list (stone, no dots).
 */
export function Picker<T = unknown>(input: PickerProps<T>) {
  const props = usePlainProps(input);
  const { t, i18n } = useTranslation(PICKER_NS);
  const ids = pickerTestIds(props.testId ?? PICKER_DEFAULT_TEST_ID);
  const mode = pickerMode(props);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState(1);
  const closeIntent = useRef<CloseIntent>('dismiss');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const source = usePickerSource(props, open, query, ids.trigger);
  const recent = usePickerRecent(mode === 'single' ? props.recentKey : undefined);
  const rows = usePickerRows(props, {
    source,
    recentKeys: recent.keys,
    mode,
    pages,
    labels: { recent: t(PICKER_KEYS.recent), all: t(PICKER_KEYS.all) },
  });
  const known = usePickerKnownOptions(props, source.options);
  const copy = pickerCopy(t, i18n.language, props, known.selected);
  const searchable = isSearchable(props, source.remote);
  const typed = query.trim();
  const exact = hasExactLabel(source.options, typed);
  const loading = source.firstLoad || source.refreshing;

  const openList = () => {
    if (props.disabled) return;
    closeIntent.current = 'dismiss';
    setQuery('');
    setPages(openingPages(props));
    setOpen(true);
    props.onOpenChange?.(true);
  };

  const closeList = (intent: CloseIntent) => {
    if (intent === 'dismiss' && props.autoCreate && typed && !exact) {
      props.onCreate?.(typed);
    }
    setOpen(false);
    setQuery('');
    props.onOpenChange?.(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      openList();
      return;
    }
    const intent = closeIntent.current;
    closeIntent.current = 'dismiss';
    closeList(intent);
  };

  const pick = (row: PickerOptionRow<T>) => {
    const { option } = row;
    if (option.disabled) return;
    known.keep(option);
    if (props.multiple) {
      const keys = toggleKey(props.value, option.key);
      const byKey = new Map(known.byKey).set(option.key, option);
      props.onChange(
        keys,
        keys.flatMap((key) => byKey.get(key) ?? []),
      );
      return;
    }
    if (mode === 'single') recent.remember(option.key);
    closeList('pick');
    props.onChange(option.key, option);
  };

  const clear = () => {
    if (props.multiple) props.onChange([], []);
    else props.onChange(null, null);
  };

  const loadMore = () => {
    if (!source.remote) {
      if (rows.hasMore) setPages((count) => count + 1);
      return;
    }
    if (source.hasMore && !source.loadingMore) source.loadMore();
  };
  const handleScroll = useLoadMoreOnScroll(loadMore);

  const labelByValue = new Map(
    rows.optionRows.map((row) => [row.value, row.option.label]),
  );
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) =>
    handlePickerKey(event, {
      list: listRef.current,
      searchable,
      labelOf: (value) => labelByValue.get(value) ?? '',
      loadMore,
      dismiss: () => closeList('dismiss'),
    });

  /** Focus the search (else the list) and make the current pick the active row. */
  const focusPanel = () => {
    (inputRef.current ?? listRef.current)?.focus({ preventScroll: true });
    const [current] = props.multiple ? [] : known.selected;
    const row = current && rows.optionRows.find((r) => r.option.key === current.key);
    if (row) activateItem(itemByValue(listRef.current, row.value));
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    openList();
  };

  const { create, createFull } = createActions(
    t,
    props,
    { typed, exact, loading, fullLabel: copy.createFullLabel },
    {
      create: (value) => {
        props.onCreate?.(value);
        setQuery('');
        if (!props.multiple) closeList('pick');
      },
      createFull: (value) => {
        closeList('pick');
        props.onCreateFull?.(value);
      },
    },
  );
  const empty =
    !loading && rows.optionRows.length === 0
      ? pickerEmptyState(t, source.searchQuery.trim(), source.remote, props.emptyText)
      : undefined;
  const showClear = clearShown(props, known.selected.length);
  const trigger =
    props.renderTrigger?.({
      open,
      selected: known.selected,
      placeholder: copy.placeholder,
      invalid: props.invalid,
      describedBy: props['aria-describedby'],
    }) ??
    defaultTrigger(props, {
      selected: known.selected,
      copy,
      mode,
      showClear,
      testId: ids.trigger,
    });

  return (
    <div className={cn('relative min-w-0', props.className)}>
      <PickerSheet
        open={open}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        onTriggerKeyDown={handleTriggerKeyDown}
        title={copy.listLabel}
        align={props.align}
        panelClassName={panelClassFor(props)}
        onOpenAutoFocus={focusPanel}
        onEscapeKeyDown={() => {
          closeIntent.current = 'escape';
        }}
        testId={ids.panel}
      >
        <PickerPanel
          label={copy.listLabel}
          testIds={ids}
          mode={mode}
          picked={new Set(known.selected.map((option) => option.key))}
          sections={loading ? [] : rows.sections}
          searchable={searchable}
          query={query}
          onQueryChange={(next) => {
            setQuery(next);
            setPages(1);
          }}
          searchPlaceholder={copy.searchPlaceholder}
          searching={source.fetching}
          skeleton={loading}
          loadingMore={source.loadingMore}
          empty={empty}
          create={create}
          createFull={createFull}
          onPick={pick}
          onKeyDown={handleListKeyDown}
          onScroll={handleScroll}
          inputRef={inputRef}
          listRef={listRef}
          footer={props.footer?.(() => closeList('pick'))}
        />
      </PickerSheet>
      {showClear ? (
        <PickerTriggerClear
          label={t(PICKER_KEYS.clear)}
          onClear={clear}
          testId={ids.clear}
        />
      ) : null}
    </div>
  );
}
