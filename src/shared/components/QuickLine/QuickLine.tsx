import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { LayoutGrid, Plus, Search } from '@/shared/icons/index.ts';

import {
  QUICK_LINE_KEYS,
  QUICK_LINE_NS,
  quickLineTestIds,
} from './quick-line.constants.ts';
import type {
  QuickLineBrowseConfig,
  QuickLineItem,
  QuickLineProps,
} from './quick-line.types.ts';
import { type QuickLineRow, useQuickLineState } from './quick-line-state.ts';
import { QuickLineBrowse } from './QuickLineBrowse.tsx';

const K = QUICK_LINE_KEYS;

/** The panels' surface: the popover's own slot (fill and elevation follow the theme). */
const PANEL_CLASS =
  'data-[state=open]:data-[side=bottom]:animate-dropdown-in data-[state=open]:data-[side=top]:animate-dropdown-up flex w-(--radix-popover-trigger-width) max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl p-0 data-[state=closed]:data-[side]:animate-none';

/** One match: its label (a "+" before an "add as typed" row), its sub line and its meta. */
function MatchRow<TItem>({
  row,
  id,
  active,
  onPick,
  onHover,
  testId,
}: {
  row: QuickLineRow<TItem>;
  id: string;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
  testId: string;
}) {
  const { t } = useTranslation(QUICK_LINE_NS);
  const typed = row.kind === 'typed';
  const sub = typed ? t(K.typed) : row.item.sub;
  const meta = typed ? undefined : row.item.meta;
  return (
    <div
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      data-testid={testId}
      // Picking keeps the focus in the line: the next item can be typed at once.
      onMouseDown={(event) => {
        event.preventDefault();
        onPick();
      }}
      onMouseEnter={onHover}
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none',
        active && 'bg-muted',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
        <span className="text-body flex items-center gap-1.5 font-medium">
          {typed ? (
            <Plus aria-hidden="true" className="text-muted-foreground size-3 flex-none" />
          ) : null}
          <span className="truncate">{typed ? row.name : row.item.label}</span>
        </span>
        {sub ? (
          <span className="text-caption text-muted-foreground truncate">{sub}</span>
        ) : null}
      </span>
      {meta ? (
        <span className="text-foreground-soft flex-none text-xs tabular-nums">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

/** The "Often prescribed" chips: each adds its item as it stands (H:3808). */
function FrequentChips<TItem>({
  label,
  items,
  onPick,
  disabled,
  testId,
}: {
  label: string;
  items: readonly QuickLineItem<TItem>[];
  onPick: (item: QuickLineItem<TItem>) => void;
  disabled?: boolean;
  testId: string;
}) {
  const labelId = useId();
  if (items.length === 0) return null;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-testid={testId}
      className="flex flex-wrap items-center gap-1.5"
    >
      <span
        id={labelId}
        className="text-micro text-muted-foreground me-0.5 font-semibold tracking-[0.05em] uppercase"
      >
        {label}
      </span>
      {items.slice(0, 6).map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={disabled}
          onClick={() => onPick(item)}
          title={item.sub ?? item.label}
          data-slot="pill"
          className="bg-background text-foreground-soft hover:bg-muted hover:text-foreground inline-flex h-6 items-center gap-1 rounded-full border ps-1.75 pe-2.5 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="text-muted-foreground size-3" />
          {item.chip ?? item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * "Browse" beside the line, and its panel anchored to the whole row (H:3797):
 * the anchor is a box laid over the row (the row is `relative`), so the panel
 * takes the row's width and place. It comes after the trigger: Radix wraps a
 * trigger in an anchor of its own until the custom one registers, and the
 * last anchor whose ref attaches wins — after Strict Mode's remount re-attached
 * the trigger's, a `virtualRef` (set once, in an effect) lost to a detached
 * button and pinned the panel 2px wide at the viewport's corner.
 */
function BrowseButton<TItem>({
  config,
  words,
  open,
  onOpenChange,
  disabled,
  testId,
}: {
  config: QuickLineBrowseConfig<TItem>;
  words: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  testId: string;
}) {
  const { t } = useTranslation(QUICK_LINE_NS);
  const ids = quickLineTestIds(testId);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={open ? 'default' : 'outline'}
          disabled={disabled}
          aria-label={t(K.browseAll)}
          title={t(K.browseAll)}
          data-testid={ids.browse}
          className={cn(
            'h-11 gap-1.5 shadow-none',
            open ? 'border-primary border' : 'text-foreground-soft hover:border-disabled',
          )}
        >
          <LayoutGrid aria-hidden="true" className="size-3.75" />
          {t(K.browse)}
        </Button>
      </PopoverTrigger>
      <PopoverAnchor
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        aria-label={t(K.browse)}
        data-testid={ids.panel}
        className={cn(
          PANEL_CLASS,
          'max-h-[min(27.5rem,max(13.75rem,var(--radix-popover-content-available-height)))]',
        )}
      >
        <QuickLineBrowse
          config={config}
          words={words}
          onClose={() => onOpenChange(false)}
          testId={testId}
        />
      </PopoverContent>
    </Popover>
  );
}

/** The matches list, or "No match…", with the keys and the grammar's hint (H:3804–3806). */
function MatchesList<TItem>({
  state,
  hint,
  listId,
  testId,
}: {
  state: ReturnType<typeof useQuickLineState<TItem, unknown>>;
  hint?: string;
  listId: string;
  testId: string;
}) {
  const { t } = useTranslation(QUICK_LINE_NS);
  const ids = quickLineTestIds(testId);
  if (state.showNone) {
    return (
      <p data-testid={ids.noMatch} className="text-detail text-muted-foreground p-2">
        {t(K.noMatch)}
      </p>
    );
  }
  return (
    <>
      <div
        id={listId}
        role="listbox"
        aria-label={t(K.matches)}
        data-testid={ids.matches}
        className="min-h-0 overflow-y-auto"
      >
        {state.suggesting ? (
          <div
            role="presentation"
            className="text-micro text-muted-foreground px-2.5 pt-1.5 pb-1 font-semibold tracking-[0.05em] uppercase"
          >
            {t(K.suggested)}
          </div>
        ) : null}
        {state.rows.map((row, index) => (
          <MatchRow
            key={row.kind === 'typed' ? `typed:${row.name}` : row.item.key}
            row={row}
            id={state.optionId(index)}
            active={index === state.current}
            onPick={() => state.add(row)}
            onHover={() => state.setActive(index)}
            testId={row.kind === 'typed' ? ids.typed : ids.option}
          />
        ))}
      </div>
      <div className="text-caption text-muted-foreground mt-1 flex items-center gap-3 border-t px-2.5 pt-1.5 pb-0.5">
        <span className="whitespace-nowrap">{t(K.keys)}</span>
        {hint ? <span className="ms-auto truncate">{hint}</span> : null}
      </div>
    </>
  );
}

/**
 * The quick line of an items field (KICKOFF §3.5 Items table; H:3789–3808;
 * `_patterns.md:135–141`) — a shell: the grammar is the host's. A 44px line
 * with the search glyph, the parsed shorthand as 22px `success` pills and the
 * "↵ add" key cap; "Browse" beside it; matches in a popover under it (at most
 * eight, "Suggested · click to add" while nothing is typed, the "Not in the
 * list · add as typed" row, "No match. Check the spelling or try fewer
 * letters.") with "↑↓ choose · ↵ add · Esc clear" and the grammar's hint; the
 * frequent chips under it. ↑ / ↓ move, ↵ adds, Esc clears a typed line (an
 * empty one closes the list, then the drawer). Adding clears the line and
 * keeps the focus in it.
 */
export function QuickLine<TItem, TValues>(props: QuickLineProps<TItem, TValues>) {
  const { placeholder, hint, frequent, browse, disabled = false, testId } = props;
  const { t } = useTranslation(QUICK_LINE_NS);
  const ids = quickLineTestIds(testId);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const state = useQuickLineState(props, listId);

  return (
    <div className="flex flex-col gap-2">
      <Popover
        open={state.showList || state.showNone}
        onOpenChange={(next) => {
          if (!next) state.setOpen(false);
        }}
      >
        <PopoverAnchor asChild>
          <div className="relative flex gap-2">
            <div
              ref={boxRef}
              className={cn(
                'bg-background focus-within:border-disabled focus-within:ring-ring/50 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border ps-3 pe-2 transition-[border-color,box-shadow] focus-within:ring-3',
                disabled && 'opacity-50',
              )}
            >
              <Search
                aria-hidden="true"
                className="text-muted-foreground size-3.75 flex-none"
              />
              <input
                type="text"
                role="combobox"
                aria-label={t(K.label)}
                aria-autocomplete="list"
                aria-expanded={state.showList}
                aria-controls={state.showList ? listId : undefined}
                aria-activedescendant={
                  state.showList ? state.optionId(state.current) : undefined
                }
                value={state.text}
                maxLength={80}
                placeholder={placeholder}
                autoComplete="off"
                disabled={disabled}
                data-testid={ids.input}
                onChange={(event) => state.type(event.target.value)}
                onFocus={() => state.setOpen(true)}
                onBlur={() => state.setOpen(false)}
                onKeyDown={state.onKeyDown}
                className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {state.text && state.parsed.tags.length > 0 ? (
                <span className="flex flex-none gap-1">
                  {state.parsed.tags.map((tag) => (
                    <span
                      key={tag}
                      data-slot="pill"
                      className="bg-success/10 text-success text-caption inline-flex h-5.5 items-center rounded-full px-2 font-medium whitespace-nowrap tabular-nums"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              ) : null}
              <kbd
                data-slot="kbd"
                className="bg-canvas text-muted-foreground text-micro flex h-5.5 flex-none items-center rounded-sm border px-1.5 font-mono"
              >
                {t(K.enter)}
              </kbd>
            </div>
            {browse ? (
              <BrowseButton
                config={browse}
                words={state.parsed.words}
                open={state.browsing}
                onOpenChange={state.setBrowsing}
                disabled={disabled}
                testId={testId}
              />
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          // Not a dialog: the line keeps the focus and the list follows its keys.
          role="presentation"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (boxRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            // A typed line clears first; an empty one closes the list.
            if (state.clear()) event.preventDefault();
          }}
          className={cn(PANEL_CLASS, 'max-h-90 p-1')}
        >
          <MatchesList state={state} hint={hint} listId={listId} testId={testId} />
        </PopoverContent>
      </Popover>
      {frequent && !state.text ? (
        <FrequentChips
          label={frequent.label}
          items={frequent.items}
          onPick={state.pickFrequent}
          disabled={disabled}
          testId={ids.frequent}
        />
      ) : null}
    </div>
  );
}
